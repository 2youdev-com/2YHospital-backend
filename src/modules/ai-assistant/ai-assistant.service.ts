import prisma from '../../config/prisma';
import { config } from '../../config/env';

// ─── System Prompts ───────────────────────────────────────

const PATIENT_SYSTEM_PROMPT = `أنت مساعد طبي ذكي تابع لمستشفى 2YHospital. مهمتك مساعدة المرضى في:
- الإجابة على أسئلتهم الطبية العامة بشكل مبسط وواضح
- مساعدتهم في فهم نتائج الفحوصات
- إرشادهم لحجز المواعيد المناسبة
- تذكيرهم بأدويتهم ومواعيد متابعتهم

قواعد مهمة:
1. لا تشخّص الأمراض أبداً ولا تصف أدوية
2. دائماً أنصح بمراجعة الطبيب للحالات الحرجة
3. تحدث باللغة العربية الفصحى السهلة
4. كن لطيفاً ومتعاطفاً
5. لا تشارك بيانات المريض مع أي طرف آخر
6. إذا رصدت مؤشرات خطر أو طوارئ، اعرض رسالة تصعيد فورية
7. إذا طُلب منك شيء خارج نطاق الطب، اعتذر بلطف`;

const DOCTOR_SYSTEM_PROMPT = `أنت مساعد طبي سريري متخصص يدعم الأطباء في مستشفى 2YHospital.
مهمتك:
- تلخيص ملفات المرضى بصياغة سريرية واضحة
- إبراز النقاط المهمة: الحساسيات، الأمراض المزمنة، النتائج غير الطبيعية
- المساعدة في صياغة ملخصات الزيارة وخطط المتابعة
- تنظيم المعلومات بترتيب سريري منطقي

قواعد:
1. لا تتخذ قرارات طبية نهائية — أنت داعم للطبيب فقط
2. نبّه بوضوح على أي نتيجة غير طبيعية أو حساسية خطيرة
3. تحدث بأسلوب طبي مهني
4. أي مسودة تولدها تبقى مسودة حتى يعتمدها الطبيب
5. لا تشارك بيانات المريض خارج السياق الطبي المعتمد`;

const ADMIN_SYSTEM_PROMPT = `أنت مساعد تشغيلي ذكي لإدارة مستشفى 2YHospital.
مهمتك تحليل مؤشرات التشغيل وتقديم ملخصات وتوصيات للمسؤولين.

يمكنك المساعدة في:
- ملخصات يومية وأسبوعية للأداء التشغيلي
- تحليل نسب الإلغاء والغياب
- تحديد ذروة الطلب وضعف الاستغلال
- اقتراح توزيع أفضل للجداول

قواعد:
1. استند دائماً على بيانات فعلية مُقدمة لك
2. أي توصية يجب أن تكون قابلة للتطبيق ومنطقية
3. لا تعرض بيانات تتجاوز صلاحيات المستخدم
4. وضّح دائماً أن التوصيات أولية وتحتاج مراجعة بشرية`;

// ─── Helpers ──────────────────────────────────────────────

async function callAI(systemPrompt: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'عذراً، حدث خطأ مؤقت. يرجى المحاولة مجدداً.';
  } catch {
    return 'عذراً، المساعد الذكي غير متاح حالياً. يرجى المحاولة لاحقاً.';
  }
}

function applySafetyGuard(response: string): string {
  // Detect attempts to prescribe specific doses
  const dangerousPatterns = [/خذ\s+\d+\s+ملغ/i, /جرعة\s+\d+\s+ملغ/i, /تناول\s+\d+\s+حبة/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(response)) {
      return 'يرجى مراجعة الطبيب المختص للحصول على نصيحة طبية دقيقة تتناسب مع حالتك الصحية الخاصة.';
    }
  }
  // Detect emergency indicators and add escalation
  const emergencyPatterns = [/ألم شديد في الصدر/i, /صعوبة في التنفس/i, /فقدان الوعي/i, /نزيف حاد/i, /طارئ/i];
  for (const pattern of emergencyPatterns) {
    if (pattern.test(response)) {
      return response + '\n\n🚨 تنبيه: إذا كانت حالتك طارئة، يرجى الاتصال بالإسعاف فوراً أو التوجه لأقرب طوارئ.';
    }
  }
  return response;
}

// ─── Service ──────────────────────────────────────────────

export class AiAssistantService {

  // ─── Patient Chat ───
  async chat(userId: string, message: string, sessionId?: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');

    let session;
    if (sessionId) {
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, patientId: patient.id },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
    }
    if (!session) {
      session = await prisma.chatSession.create({
        data: { patientId: patient.id },
        include: { messages: true },
      });
    }

    const history = (session.messages || []).map((m: any) => ({ role: m.role, content: m.content }));

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content: message },
    });

    const rawResponse = await callAI(PATIENT_SYSTEM_PROMPT, message, history);
    const safeResponse = applySafetyGuard(rawResponse);

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: safeResponse },
    });

    return { sessionId: session.id, response: safeResponse };
  }

  // ─── Doctor: Smart Patient Summary (UC-D-02) ───
  async getDoctorPatientSummaryAI(doctorUserId: string, patientId: string): Promise<string> {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new Error('المريض غير موجود');

    // Collect patient data
    const [recentVisits, labResults, prescriptions, radiology, notes] = await Promise.all([
      prisma.visitHistory.findMany({ where: { patientId }, orderBy: { visitDate: 'desc' }, take: 5 }),
      prisma.labResult.findMany({ where: { patientId }, orderBy: { orderDate: 'desc' }, take: 10 }),
      prisma.prescription.findMany({ where: { patientId, isActive: true }, orderBy: { issueDate: 'desc' }, take: 5 }),
      prisma.radiologyReport.findMany({ where: { patientId }, orderBy: { studyDate: 'desc' }, take: 3 }),
      prisma.medicalNote.findMany({ where: { patientId, isDraft: false }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);

    const patientContext = `
معلومات المريض:
- الاسم: ${patient.nameAr}
- تاريخ الميلاد: ${patient.dateOfBirth.toLocaleDateString('ar-SA')}
- فصيلة الدم: ${patient.bloodType || 'غير محدد'}
- الحساسية: ${patient.allergies?.length ? patient.allergies.join('، ') : 'لا توجد'}
- الأمراض المزمنة: ${patient.chronicDiseases?.length ? patient.chronicDiseases.join('، ') : 'لا توجد'}

آخر الزيارات (${recentVisits.length}):
${recentVisits.map(v => `- ${new Date(v.visitDate).toLocaleDateString('ar-SA')}: ${v.diagnosis || v.chiefComplaint || 'غير محدد'}`).join('\n')}

نتائج المختبر الأخيرة (${labResults.length}):
${labResults.map(l => `- ${l.testName} (${new Date(l.orderDate).toLocaleDateString('ar-SA')}): ${l.status}${l.isAbnormal ? ' ⚠️ غير طبيعي' : ''}`).join('\n')}

الأدوية الحالية (${prescriptions.length}):
${prescriptions.map(p => `- ${JSON.stringify(p.medications)}`).join('\n')}

تقارير الأشعة الأخيرة (${radiology.length}):
${radiology.map(r => `- ${r.modalityType} - ${r.bodyPart || ''} (${new Date(r.studyDate).toLocaleDateString('ar-SA')}): ${r.impression || r.findings || 'بدون ملاحظات'}`).join('\n')}
    `.trim();

    const message = `قدّم ملخصاً سريرياً مختصراً ومنظماً لهذا المريض استعداداً للزيارة القادمة. ركّز على أهم النقاط السريرية والتنبيهات.\n\n${patientContext}`;

    return callAI(DOCTOR_SYSTEM_PROMPT, message);
  }

  // ─── Doctor: Draft visit summary (UC-D-03) ───
  async draftVisitSummary(doctorUserId: string, input: { patientId: string; notes: string; chiefComplaint?: string }): Promise<string> {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const patient = await prisma.patient.findUnique({ where: { id: input.patientId }, select: { nameAr: true, chronicDiseases: true, allergies: true } });
    if (!patient) throw new Error('المريض غير موجود');

    const message = `
بناءً على ملاحظات الطبيب التالية، اقترح مسودة ملخص زيارة واضحة ومنظمة.

المريض: ${patient.nameAr}
الأمراض المزمنة: ${patient.chronicDiseases?.join('، ') || 'لا توجد'}
الشكوى الرئيسية: ${input.chiefComplaint || 'غير محددة'}

ملاحظات الطبيب:
${input.notes}

اقترح مسودة تشمل: التشخيص، الخطة العلاجية، تعليمات المتابعة. وضّح أن هذا مقترح يتطلب مراجعة الطبيب واعتماده.
    `.trim();

    return callAI(DOCTOR_SYSTEM_PROMPT, message);
  }

  // ─── Admin: Operational Summary (UC-A-04 / US-A-04) ───
  async getAdminOperationalSummary(period: 'daily' | 'weekly'): Promise<string> {
    const now = new Date();
    const from = new Date(now);
    if (period === 'daily') {
      from.setDate(from.getDate() - 1);
    } else {
      from.setDate(from.getDate() - 7);
    }

    const [
      totalAppts,
      confirmedAppts,
      cancelledAppts,
      noShowAppts,
      completedAppts,
      newPatients,
      totalRevenue,
      topDoctors,
    ] = await Promise.all([
      prisma.appointment.count({ where: { createdAt: { gte: from } } }),
      prisma.appointment.count({ where: { createdAt: { gte: from }, status: 'CONFIRMED' } }),
      prisma.appointment.count({ where: { createdAt: { gte: from }, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { createdAt: { gte: from }, status: 'NO_SHOW' } }),
      prisma.appointment.count({ where: { createdAt: { gte: from }, status: 'COMPLETED' } }),
      prisma.patient.count({ where: { createdAt: { gte: from } } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: from }, status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.appointment.groupBy({
        by: ['doctorId'],
        where: { createdAt: { gte: from } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3,
      }),
    ]);

    const cancellationRate = totalAppts > 0 ? ((cancelledAppts / totalAppts) * 100).toFixed(1) : '0';
    const completionRate   = totalAppts > 0 ? ((completedAppts / totalAppts) * 100).toFixed(1) : '0';

    const statsContext = `
فترة التقرير: ${period === 'daily' ? 'يومي (آخر 24 ساعة)' : 'أسبوعي (آخر 7 أيام)'}
تاريخ التقرير: ${now.toLocaleDateString('ar-SA')}

إحصائيات المواعيد:
- إجمالي المواعيد: ${totalAppts}
- مؤكدة: ${confirmedAppts}
- مكتملة: ${completedAppts} (${completionRate}%)
- ملغاة: ${cancelledAppts} (${cancellationRate}%)
- غياب: ${noShowAppts}

المرضى الجدد: ${newPatients}
الإيرادات المحصّلة: ${totalRevenue._sum.amount?.toString() || '0'} ريال

الأطباء الأكثر نشاطاً (حسب المواعيد):
${topDoctors.map((d, i) => `${i + 1}. طبيب (${d._count.id} موعد)`).join('\n')}
    `.trim();

    const message = `بناءً على هذه الإحصائيات، قدّم ملخصاً تشغيلياً واضحاً مع أبرز المؤشرات والتوصيات الأولية لتحسين الأداء.\n\n${statsContext}`;

    return callAI(ADMIN_SYSTEM_PROMPT, message);
  }

  // ─── Session management ───
  async getChatHistory(userId: string, sessionId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, patientId: patient.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new Error('الجلسة غير موجودة');
    return session;
  }

  async getMySessions(userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    return prisma.chatSession.findMany({
      where: { patientId: patient.id },
      orderBy: { startedAt: 'desc' },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
  }
}
