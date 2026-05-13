import { config } from '../../config/env';
import {
  AiAssistantContextService,
  AiChatHistoryItem,
} from './ai-assistant.context';

const PATIENT_SYSTEM_PROMPT = `
You are the patient AI assistant for 2YHospital.
Use only the allowed patient context supplied by the backend access layer.
Never claim to see records outside that context. Never expose another patient's data.
Give general medical education and help the patient understand their own appointments, results, and prescriptions.
Do not diagnose, prescribe medication, or give exact dosage instructions.
For urgent symptoms, advise immediate emergency care.
Reply in clear Arabic unless the user asks for another language.
`.trim();

const DOCTOR_SYSTEM_PROMPT = `
You are the clinical AI assistant for doctors at 2YHospital.
Use only the allowed doctor or doctor-patient context supplied by the backend access layer.
If no scoped patient context is supplied, do not discuss any individual patient.
If patient context is supplied, treat it as limited to the authenticated doctor's authorized patient relationship.
Do not make final medical decisions. Drafts and summaries require doctor review and approval.
Reply in professional Arabic unless the user asks for another language.
`.trim();

const ADMIN_SYSTEM_PROMPT = `
You are the operational AI assistant for 2YHospital administrators.
Use only aggregate operational context supplied by the backend access layer.
Do not request, infer, reveal, or summarize individual patient records.
Recommendations are preliminary and must be reviewed by hospital staff.
Reply in clear Arabic unless the user asks for another language.
`.trim();

const dataAccess = new AiAssistantContextService();

async function callAI(
  systemPrompt: string,
  userMessage: string,
  history: AiChatHistoryItem[] = [],
): Promise<string> {
  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider returned ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'عذرا، حدث خطأ مؤقت. يرجى المحاولة مجددا.';
  } catch {
    return 'عذرا، المساعد الذكي غير متاح حاليا. يرجى المحاولة لاحقا.';
  }
}

function applySafetyGuard(response: string): string {
  const dangerousPatterns = [
    /خذ\s+\d+\s+ملغ/i,
    /جرعة\s+\d+\s+ملغ/i,
    /تناول\s+\d+\s+حبة/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(response)) {
      return 'يرجى مراجعة الطبيب المختص للحصول على نصيحة طبية دقيقة تتناسب مع حالتك الصحية الخاصة.';
    }
  }

  const emergencyPatterns = [
    /ألم شديد في الصدر/i,
    /صعوبة في التنفس/i,
    /فقدان الوعي/i,
    /نزيف حاد/i,
    /طارئ/i,
  ];

  for (const pattern of emergencyPatterns) {
    if (pattern.test(response)) {
      return `${response}\n\nتنبيه: إذا كانت الحالة طارئة، يرجى الاتصال بالإسعاف فورا أو التوجه لأقرب طوارئ.`;
    }
  }

  return response;
}

function withContext(systemPrompt: string, context: string): string {
  return `${systemPrompt}\n\nBackend-scoped context:\n${context}`;
}

export class AiAssistantService {
  async chat(userId: string, message: string, sessionId?: string) {
    const scoped = await dataAccess.getPatientChatContext(userId, sessionId);

    await dataAccess.appendPatientChatMessage(scoped.sessionId, 'user', message);

    const rawResponse = await callAI(
      withContext(PATIENT_SYSTEM_PROMPT, scoped.context),
      message,
      scoped.history,
    );
    const safeResponse = applySafetyGuard(rawResponse);

    await dataAccess.appendPatientChatMessage(scoped.sessionId, 'assistant', safeResponse);

    return { sessionId: scoped.sessionId, response: safeResponse };
  }

  async doctorChat(doctorUserId: string, message: string, patientId?: string) {
    const scoped = patientId
      ? await dataAccess.getDoctorPatientContext(doctorUserId, patientId)
      : await dataAccess.getDoctorGeneralContext(doctorUserId);

    const rawResponse = await callAI(
      withContext(DOCTOR_SYSTEM_PROMPT, scoped.context),
      message,
    );

    return { response: applySafetyGuard(rawResponse) };
  }

  async adminChat(message: string, period: 'daily' | 'weekly' = 'daily') {
    const context = await dataAccess.getAdminOperationalContext(period);
    const response = await callAI(
      withContext(ADMIN_SYSTEM_PROMPT, context),
      message,
    );

    return { response };
  }

  async getDoctorPatientSummaryAI(doctorUserId: string, patientId: string): Promise<string> {
    const scoped = await dataAccess.getDoctorPatientContext(doctorUserId, patientId);
    const message = [
      'قدم ملخصا سريريا مختصرا ومنظما لهذا المريض استعدادا للزيارة القادمة.',
      'ركز على أهم النقاط السريرية والتنبيهات. استخدم فقط السياق المقدم.',
    ].join('\n');

    return callAI(withContext(DOCTOR_SYSTEM_PROMPT, scoped.context), message);
  }

  async draftVisitSummary(
    doctorUserId: string,
    input: { patientId: string; notes: string; chiefComplaint?: string },
  ): Promise<string> {
    const scoped = await dataAccess.getDoctorPatientContext(doctorUserId, input.patientId);
    const message = `
بناء على ملاحظات الطبيب التالية، اقترح مسودة ملخص زيارة واضحة ومنظمة.
الشكوى الرئيسية: ${input.chiefComplaint || 'غير محددة'}

ملاحظات الطبيب:
${input.notes}

اقترح مسودة تشمل: التشخيص، الخطة العلاجية، تعليمات المتابعة. وضح أن هذا مقترح يتطلب مراجعة الطبيب واعتماده.
    `.trim();

    return callAI(withContext(DOCTOR_SYSTEM_PROMPT, scoped.context), message);
  }

  async getAdminOperationalSummary(period: 'daily' | 'weekly'): Promise<string> {
    const context = await dataAccess.getAdminOperationalContext(period);
    const message = 'بناء على هذه الإحصائيات، قدم ملخصا تشغيليا واضحا مع أبرز المؤشرات والتوصيات الأولية لتحسين الأداء.';

    return callAI(withContext(ADMIN_SYSTEM_PROMPT, context), message);
  }

  async getChatHistory(userId: string, sessionId: string) {
    return dataAccess.getChatHistory(userId, sessionId);
  }

  async getMySessions(userId: string) {
    return dataAccess.getMySessions(userId);
  }
}
