import cron from 'node-cron';
import prisma from '../../config/prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

const notifService = new NotificationsService();

/**
 * Runs every hour at minute 0.
 * Sends reminders for appointments starting in ~24 hours.
 * Sends reminders for appointments starting in ~2 hours.
 */
export const startReminderScheduler = (): void => {
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running appointment reminder scheduler...');
    try {
      await sendReminders();
    } catch (err) {
      console.error('❌ Reminder scheduler error:', err);
    }
  });

  console.log('✅ Appointment reminder scheduler started');
};

async function sendReminders() {
  const now = new Date();

  // ── 24-hour reminders ──
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const window24Start = new Date(in24h.getTime() - 30 * 60 * 1000);
  const window24End   = new Date(in24h.getTime() + 30 * 60 * 1000);

  // ── 2-hour reminders ──
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const window2Start = new Date(in2h.getTime() - 15 * 60 * 1000);
  const window2End   = new Date(in2h.getTime() + 15 * 60 * 1000);

  const tomorrow24Date = in24h.toISOString().slice(0, 10);
  const today2hDate    = in2h.toISOString().slice(0, 10);

  // BUG FIX: 24h window → only fetch appointments where reminderSent = false
  // 2h window → fetch all (reminderSent may already be true from 24h reminder)
  const appts24h = await getUpcomingAppointments(tomorrow24Date, false);
  for (const appt of appts24h) {
    const apptTime = parseTime(appt.date, appt.startTime);
    if (apptTime >= window24Start && apptTime <= window24End) {
      await sendAndMark(appt, '24h');
    }
  }

  // For 2h reminders, we fetch all (including those that already got 24h reminder)
  const appts2h = await getUpcomingAppointments(today2hDate, null);
  for (const appt of appts2h) {
    const apptTime = parseTime(appt.date, appt.startTime);
    if (apptTime >= window2Start && apptTime <= window2End) {
      await sendAndMark(appt, '2h');
    }
  }
}

// FIX: reminderSent filter now works correctly
// null = no filter (fetch all), false = only unsent
async function getUpcomingAppointments(date: string, reminderSentFilter: boolean | null) {
  const where: any = {
    date: new Date(date),
    status: { in: ['CONFIRMED', 'PENDING'] },
  };

  if (reminderSentFilter !== null) {
    where.reminderSent = reminderSentFilter;
  }

  return prisma.appointment.findMany({
    where,
    include: {
      patient: { include: { user: true } },
      doctor: { select: { nameAr: true, specialty: { select: { nameAr: true } } } },
    },
  });
}

async function sendAndMark(appt: any, window: '24h' | '2h') {
  try {
    const userId = appt.patient?.user?.id;
    if (!userId) return;

    const doctorName = appt.doctor?.nameAr || 'الطبيب';
    const specialty  = appt.doctor?.specialty?.nameAr || '';
    const timeStr    = appt.startTime;
    const dateStr    = new Date(appt.date).toLocaleDateString('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const title = window === '24h' ? 'تذكير بموعدك غداً' : 'موعدك بعد ساعتين';
    const body  = `لديك موعد مع ${doctorName}${specialty ? ` - ${specialty}` : ''} في ${dateStr} الساعة ${timeStr}. رقم المرجع: ${appt.referenceNumber}`;

    await notifService.sendNotification({
      userId,
      type: NotificationType.APPOINTMENT_REMINDER,
      title,
      body,
      extra: { appointmentId: appt.id, referenceNumber: appt.referenceNumber },
    });

    // Only mark reminderSent=true for 24h reminder
    if (window === '24h') {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSent: true },
      });
    }

    console.log(`📨 Reminder (${window}) sent for appointment ${appt.referenceNumber}`);
  } catch (err) {
    console.error(`❌ Failed to send reminder for ${appt.id}:`, err);
  }
}

function parseTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}