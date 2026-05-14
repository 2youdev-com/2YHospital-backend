import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';

export class MedicalRecordsService {
  private async getPatientId(userId: string): Promise<string> {
    const p = await prisma.patient.findFirst({ where: { userId } });
    if (!p) throw new Error('المريض غير موجود');
    return p.id;
  }

  // ─── Lab Results ───
  async getLabResults(userId: string, page = 1, limit = 10) {
    const patientId = await this.getPatientId(userId);
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.labResult.findMany({
        where: { patientId },
        orderBy: { orderDate: 'desc' },
        skip, take,
      }),
      prisma.labResult.count({ where: { patientId } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
  }

  async getLabResult(userId: string, id: string) {
    const patientId = await this.getPatientId(userId);
    const r = await prisma.labResult.findFirst({ where: { id, patientId } });
    if (!r) throw new Error('النتيجة غير موجودة');
    return r;
  }

  // ─── Radiology ───
  async getRadiologyReports(userId: string, page = 1, limit = 10) {
    const patientId = await this.getPatientId(userId);
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.radiologyReport.findMany({
        where: { patientId },
        orderBy: { studyDate: 'desc' },
        skip, take,
      }),
      prisma.radiologyReport.count({ where: { patientId } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
  }

  async getRadiologyReport(userId: string, id: string) {
    const patientId = await this.getPatientId(userId);
    const r = await prisma.radiologyReport.findFirst({ where: { id, patientId } });
    if (!r) throw new Error('التقرير غير موجود');
    return r;
  }

  // ─── Prescriptions ───
  async getPrescriptions(userId: string, page = 1, limit = 10) {
    const patientId = await this.getPatientId(userId);
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where: { patientId },
        include: { doctor: { select: { nameAr: true } } },
        orderBy: { issueDate: 'desc' },
        skip, take,
      }),
      prisma.prescription.count({ where: { patientId } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
  }

  // ─── Visit History ───
  async getVisitHistory(userId: string, page = 1, limit = 10) {
    const patientId = await this.getPatientId(userId);
    const { skip, take } = getPagination(page, limit);
    const [items, total] = await Promise.all([
      prisma.visitHistory.findMany({
        where: { patientId },
        include: {
          appointment: {
            include: { doctor: { select: { nameAr: true, specialty: true } } }
          }
        },
        orderBy: { visitDate: 'desc' },
        skip, take,
      }),
      prisma.visitHistory.count({ where: { patientId } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit) };
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

  // ─── Doctor: get patient summary ───
  async getPatientSummary(patientId: string, doctorUserId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new Error('المريض غير موجود');

    const authorized = await this.doctorCanAccessPatient(doctor.id, patientId);
    if (!authorized) throw new Error('ليس لديك صلاحية للوصول إلى ملف هذا المريض');

    const [recentVisits, labResults, prescriptions, radiology] = await Promise.all([
      prisma.visitHistory.findMany({
        where: { patientId },
        orderBy: { visitDate: 'desc' },
        take: 5,
      }),
      prisma.labResult.findMany({
        where: { patientId, isAbnormal: true },
        orderBy: { orderDate: 'desc' },
        take: 5,
      }),
      prisma.prescription.findMany({
        where: { patientId, isActive: true },
        orderBy: { issueDate: 'desc' },
        take: 5,
      }),
      prisma.radiologyReport.findMany({
        where: { patientId },
        orderBy: { studyDate: 'desc' },
        take: 3,
      }),
    ]);

    return {
      patient: {
        nameAr: patient.nameAr,
        mrn: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        bloodType: patient.bloodType,
        allergies: patient.allergies,
        chronicDiseases: patient.chronicDiseases,
      },
      recentVisits,
      abnormalLabResults: labResults,
      activePrescriptions: prescriptions,
      recentRadiology: radiology,
    };
  }

  // ─── Doctor: add medical note ───
  async addMedicalNote(doctorUserId: string, patientId: string, content: string) {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId } });
    if (!doctor) throw new Error('الطبيب غير موجود');

    const authorized = await this.doctorCanAccessPatient(doctor.id, patientId);
    if (!authorized) throw new Error('ليس لديك صلاحية لإضافة ملاحظات لهذا المريض');

    return prisma.medicalNote.create({
      data: { patientId, doctorId: doctor.id, content, isDraft: true },
    });
  }

  async approveMedicalNote(doctorUserId: string, noteId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUserId } });
    if (!doctor) throw new Error('الطبيب غير موجود');
    const note = await prisma.medicalNote.findFirst({
      where: { id: noteId, doctorId: doctor.id },
    });
    if (!note) throw new Error('الملاحظة غير موجودة');
    return prisma.medicalNote.update({
      where: { id: noteId },
      data: { isDraft: false, approvedAt: new Date() },
    });
  }
}
