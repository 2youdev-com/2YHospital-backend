import { PrismaClient, UserRole, Gender, DayOfWeek } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Specialties ───
  const specialties = await Promise.all([
    prisma.specialty.upsert({ where: { code: 'GEN' }, update: {}, create: { nameAr: 'طب عام', nameEn: 'General Medicine', code: 'GEN', icon: '🏥' } }),
    prisma.specialty.upsert({ where: { code: 'CAR' }, update: {}, create: { nameAr: 'أمراض القلب', nameEn: 'Cardiology', code: 'CAR', icon: '❤️' } }),
    prisma.specialty.upsert({ where: { code: 'DER' }, update: {}, create: { nameAr: 'الجلدية', nameEn: 'Dermatology', code: 'DER', icon: '🩺' } }),
    prisma.specialty.upsert({ where: { code: 'PED' }, update: {}, create: { nameAr: 'طب الأطفال', nameEn: 'Pediatrics', code: 'PED', icon: '👶' } }),
    prisma.specialty.upsert({ where: { code: 'ORT' }, update: {}, create: { nameAr: 'العظام', nameEn: 'Orthopedics', code: 'ORT', icon: '🦴' } }),
    prisma.specialty.upsert({ where: { code: 'GYN' }, update: {}, create: { nameAr: 'النساء والتوليد', nameEn: 'Gynecology', code: 'GYN', icon: '👩‍⚕️' } }),
    prisma.specialty.upsert({ where: { code: 'OPH' }, update: {}, create: { nameAr: 'طب العيون', nameEn: 'Ophthalmology', code: 'OPH', icon: '👁️' } }),
    prisma.specialty.upsert({ where: { code: 'NEU' }, update: {}, create: { nameAr: 'الأعصاب', nameEn: 'Neurology', code: 'NEU', icon: '🧠' } }),
  ]);
  console.log(`✅ ${specialties.length} specialties created`);

  // ─── Branch ───
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-main' },
    update: {},
    create: { id: 'branch-main', nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', address: 'شارع المستشفى، المدينة', phone: '0501234567' },
  });
  console.log('✅ Branch created');

  // ─── Admin user ───
  const adminUser = await prisma.user.upsert({
    where: { phone: '+201000000000' },
    update: {},
    create: {
      phone: '+201000000000',
      role: UserRole.ADMIN,
      admin: { create: { nameAr: 'مدير النظام', nameEn: 'System Admin', position: 'Super Admin' } },
    },
  });
  console.log('✅ Admin user created');

  // ─── Receptionist user ───
  await prisma.user.upsert({
    where: { phone: '+201533333333' },
    update: {},
    create: {
      phone: '+201533333333',
      role: UserRole.RECEPTIONIST,
    },
  });
  console.log('✅ Receptionist user created');

  // ─── Finance user ───
  await prisma.user.upsert({
    where: { phone: '+201044444444' },
    update: {},
    create: {
      phone: '+201044444444',
      role: UserRole.FINANCE,
    },
  });
  console.log('✅ Finance user created');

  // ─── Doctor user ───
  const doctorUser = await prisma.user.upsert({
    where: { phone: '+201111111111' },
    update: {},
    create: {
      phone: '+201111111111',
      role: UserRole.DOCTOR,
      doctor: {
        create: {
          nameAr: 'د. أحمد محمد',
          nameEn: 'Dr. Ahmed Mohammed',
          specialtyId: specialties[0].id,
          licenseNumber: 'LIC-001-2024',
          bio: 'طبيب عام بخبرة 10 سنوات',
          consultationFee: 150,
        },
      },
    },
    include: { doctor: true },
  });

  // Schedule for doctor
  if (doctorUser.doctor) {
    const workDays: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (const day of workDays) {
      await prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek_branchId: { doctorId: doctorUser.doctor.id, dayOfWeek: day, branchId: branch.id } },
        update: {
          startTime: '08:00',
          endTime: '22:00',
          slotDuration: 20,
          isActive: true,
        },
        create: {
          doctorId: doctorUser.doctor.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '22:00',
          slotDuration: 20,
          branchId: branch.id,
        },
      });
    }
  }
  console.log('✅ Doctor created with schedule');

  // ─── Patient user ───
  await prisma.user.upsert({
    where: { phone: '+201222222222' },
    update: {},
    create: {
      phone: '+201222222222',
      role: UserRole.PATIENT,
      patient: {
        create: {
          mrn: 'MRN-2024-001',
          nameAr: 'محمد عبدالله',
          nameEn: 'Mohammed Abdullah',
          dateOfBirth: new Date('1990-05-15'),
          gender: Gender.MALE,
          bloodType: 'O+',
          allergies: ['البنسلين'],
          chronicDiseases: ['ضغط الدم'],
          email: 'patient@example.com',
        },
      },
    },
  });
  console.log('✅ Sample patient created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nTest accounts:');
  console.log('  Admin:   +201000000000');
  console.log('  Doctor:  +201111111111');
  console.log('  Patient: +201222222222');
  console.log('  Receptionist: +201533333333');
  console.log('  Finance: +201044444444');
  console.log('  (In dev mode, OTP is logged to console)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
