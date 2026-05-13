import prisma from '../../config/prisma';

type ChatRole = 'user' | 'assistant';

export interface AiChatHistoryItem {
  role: ChatRole;
  content: string;
}

export interface PatientChatContext {
  patientId: string;
  sessionId: string;
  history: AiChatHistoryItem[];
  context: string;
}

export interface DoctorPatientContext {
  doctorId: string;
  patientId: string;
  context: string;
}

function fmtDate(date?: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : 'not specified';
}

function asList(value?: string[] | null): string {
  return value?.length ? value.join(', ') : 'none recorded';
}

function stringifyJson(value: unknown): string {
  if (value == null) return 'none recorded';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export class AiAssistantContextService {
  async getPatientChatContext(userId: string, sessionId?: string): Promise<PatientChatContext> {
    const patient = await prisma.patient.findFirst({
      where: { userId },
      select: {
        id: true,
        nameAr: true,
        dateOfBirth: true,
        bloodType: true,
        allergies: true,
        chronicDiseases: true,
      },
    });
    if (!patient) throw new Error('Patient profile was not found');

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [appointments, labResults, prescriptions] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: patient.id, date: { gte: today } },
        include: { doctor: { select: { nameAr: true, specialty: { select: { nameAr: true } } } } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: 3,
      }),
      prisma.labResult.findMany({
        where: { patientId: patient.id },
        orderBy: { orderDate: 'desc' },
        take: 5,
      }),
      prisma.prescription.findMany({
        where: { patientId: patient.id, isActive: true },
        orderBy: { issueDate: 'desc' },
        take: 5,
      }),
    ]);

    return {
      patientId: patient.id,
      sessionId: session.id,
      history: (session.messages || [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as ChatRole, content: m.content })),
      context: [
        'Allowed patient context. This data belongs only to the authenticated patient.',
        `Name: ${patient.nameAr}`,
        `Date of birth: ${fmtDate(patient.dateOfBirth)}`,
        `Blood type: ${patient.bloodType || 'not specified'}`,
        `Allergies: ${asList(patient.allergies)}`,
        `Chronic diseases: ${asList(patient.chronicDiseases)}`,
        `Upcoming appointments: ${appointments.length ? appointments.map((a) => `${fmtDate(a.date)} ${a.startTime} with ${a.doctor.nameAr} (${a.doctor.specialty?.nameAr || 'specialty not specified'}) - ${a.status}`).join('; ') : 'none recorded'}`,
        `Recent lab results: ${labResults.length ? labResults.map((l) => `${l.testName} on ${fmtDate(l.orderDate)} - ${l.status}${l.isAbnormal ? ' abnormal' : ''}`).join('; ') : 'none recorded'}`,
        `Active prescriptions: ${prescriptions.length ? prescriptions.map((p) => stringifyJson(p.medications)).join('; ') : 'none recorded'}`,
      ].join('\n'),
    };
  }

  async appendPatientChatMessage(sessionId: string, role: ChatRole, content: string) {
    return prisma.chatMessage.create({ data: { sessionId, role, content } });
  }

  async getChatHistory(userId: string, sessionId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId }, select: { id: true } });
    if (!patient) throw new Error('Patient profile was not found');

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, patientId: patient.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new Error('Chat session was not found');
    return session;
  }

  async getMySessions(userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId }, select: { id: true } });
    if (!patient) throw new Error('Patient profile was not found');

    return prisma.chatSession.findMany({
      where: { patientId: patient.id },
      orderBy: { startedAt: 'desc' },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
  }

  async getDoctorGeneralContext(doctorUserId: string): Promise<{ doctorId: string; context: string }> {
    const doctor = await prisma.doctor.findFirst({
      where: { userId: doctorUserId },
      include: { specialty: { select: { nameAr: true } } },
    });
    if (!doctor) throw new Error('Doctor profile was not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayCount, pendingCount, completedCount] = await Promise.all([
      prisma.appointment.count({ where: { doctorId: doctor.id, date: { gte: today, lt: tomorrow } } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, status: 'PENDING' } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, status: 'COMPLETED' } }),
    ]);

    return {
      doctorId: doctor.id,
      context: [
        'Allowed doctor context. No patient-level details are included unless a scoped patient is requested and authorized.',
        `Doctor: ${doctor.nameAr}`,
        `Specialty: ${doctor.specialty?.nameAr || 'not specified'}`,
        `Appointments today: ${todayCount}`,
        `Pending appointments: ${pendingCount}`,
        `Completed appointments: ${completedCount}`,
      ].join('\n'),
    };
  }

  async getDoctorPatientContext(doctorUserId: string, patientId: string): Promise<DoctorPatientContext> {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId }, select: { id: true, nameAr: true } });
    if (!doctor) throw new Error('Doctor profile was not found');

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        nameAr: true,
        dateOfBirth: true,
        bloodType: true,
        allergies: true,
        chronicDiseases: true,
      },
    });
    if (!patient) throw new Error('Patient profile was not found');

    const authorized = await this.doctorCanAccessPatient(doctor.id, patientId);
    if (!authorized) throw new Error('Doctor is not authorized to access this patient context');

    const [recentVisits, labResults, prescriptions, radiology, notes] = await Promise.all([
      prisma.visitHistory.findMany({ where: { patientId, doctorId: doctor.id }, orderBy: { visitDate: 'desc' }, take: 5 }),
      prisma.labResult.findMany({ where: { patientId }, orderBy: { orderDate: 'desc' }, take: 10 }),
      prisma.prescription.findMany({ where: { patientId, doctorId: doctor.id, isActive: true }, orderBy: { issueDate: 'desc' }, take: 5 }),
      prisma.radiologyReport.findMany({ where: { patientId }, orderBy: { studyDate: 'desc' }, take: 3 }),
      prisma.medicalNote.findMany({ where: { patientId, doctorId: doctor.id, isDraft: false }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);

    return {
      doctorId: doctor.id,
      patientId: patient.id,
      context: [
        'Allowed doctor-patient context. This patient is linked to the authenticated doctor.',
        `Patient name: ${patient.nameAr}`,
        `Date of birth: ${fmtDate(patient.dateOfBirth)}`,
        `Blood type: ${patient.bloodType || 'not specified'}`,
        `Allergies: ${asList(patient.allergies)}`,
        `Chronic diseases: ${asList(patient.chronicDiseases)}`,
        `Recent visits: ${recentVisits.length ? recentVisits.map((v) => `${fmtDate(v.visitDate)} - ${v.diagnosis || v.chiefComplaint || 'not specified'}`).join('; ') : 'none recorded'}`,
        `Recent lab results: ${labResults.length ? labResults.map((l) => `${l.testName} on ${fmtDate(l.orderDate)} - ${l.status}${l.isAbnormal ? ' abnormal' : ''}`).join('; ') : 'none recorded'}`,
        `Active prescriptions by this doctor: ${prescriptions.length ? prescriptions.map((p) => stringifyJson(p.medications)).join('; ') : 'none recorded'}`,
        `Radiology reports: ${radiology.length ? radiology.map((r) => `${r.modalityType} ${r.bodyPart || ''} on ${fmtDate(r.studyDate)} - ${r.impression || r.findings || 'no notes'}`).join('; ') : 'none recorded'}`,
        `Approved notes by this doctor: ${notes.length ? notes.map((n) => n.content).join('; ') : 'none recorded'}`,
      ].join('\n'),
    };
  }

  async getAdminOperationalContext(period: 'daily' | 'weekly'): Promise<string> {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (period === 'daily' ? 1 : 7));

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
    const completionRate = totalAppts > 0 ? ((completedAppts / totalAppts) * 100).toFixed(1) : '0';

    return [
      'Allowed admin context. This is aggregate operational data only; no individual patient records are included.',
      `Report period: ${period}`,
      `Report date: ${fmtDate(now)}`,
      `Total appointments: ${totalAppts}`,
      `Confirmed: ${confirmedAppts}`,
      `Completed: ${completedAppts} (${completionRate}%)`,
      `Cancelled: ${cancelledAppts} (${cancellationRate}%)`,
      `No-show: ${noShowAppts}`,
      `New patients: ${newPatients}`,
      `Collected revenue: ${totalRevenue._sum.amount?.toString() || '0'}`,
      `Top doctor appointment counts: ${topDoctors.map((d, i) => `${i + 1}. ${d._count.id}`).join(', ') || 'none recorded'}`,
    ].join('\n');
  }

  private async doctorCanAccessPatient(doctorId: string, patientId: string): Promise<boolean> {
    const [appointment, note, prescription, visit] = await Promise.all([
      prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
      prisma.medicalNote.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
      prisma.prescription.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
      prisma.visitHistory.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
    ]);

    return Boolean(appointment || note || prescription || visit);
  }
}
