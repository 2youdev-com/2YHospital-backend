import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';

export class PatientsService {
  async getProfile(userId: string) {
    const patient = await prisma.patient.findFirst({
      where: { userId },
      include: { user: { select: { phone: true, role: true } } },
    });
    if (!patient) throw new Error('الملف الشخصي غير موجود');
    return patient;
  }

  async updateProfile(userId: string, data: any) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('الملف الشخصي غير موجود');

    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        email: data.email,
        bloodType: data.bloodType,
        allergies: data.allergies,
        chronicDiseases: data.chronicDiseases,
        emergencyContact: data.emergencyContact,
      },
    });
    return updated;
  }

  async getDependents(userId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    return prisma.dependent.findMany({ where: { patientId: patient.id } });
  }

  async addDependent(userId: string, data: any) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    return prisma.dependent.create({
      data: {
        patientId: patient.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        relation: data.relation,
        nationalId: data.nationalId,
      },
    });
  }

  async removeDependent(userId: string, dependentId: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    const dep = await prisma.dependent.findFirst({
      where: { id: dependentId, patientId: patient.id },
    });
    if (!dep) throw new Error('التابع غير موجود');
    await prisma.dependent.delete({ where: { id: dependentId } });
  }
  // ─── Allergies management ───
  async addAllergy(userId: string, allergy: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    if (patient.allergies.includes(allergy)) throw new Error('هذه الحساسية مضافة بالفعل');
    return prisma.patient.update({
      where: { id: patient.id },
      data: { allergies: { push: allergy } },
      select: { allergies: true },
    });
  }

  async removeAllergy(userId: string, allergy: string) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    const updated = patient.allergies.filter((a) => a !== allergy);
    return prisma.patient.update({
      where: { id: patient.id },
      data: { allergies: updated },
      select: { allergies: true },
    });
  }

  async updateChronicDiseases(userId: string, diseases: string[]) {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (!patient) throw new Error('المريض غير موجود');
    return prisma.patient.update({
      where: { id: patient.id },
      data: { chronicDiseases: diseases },
      select: { chronicDiseases: true },
    });
  }
}
