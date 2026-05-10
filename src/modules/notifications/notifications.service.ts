import prisma from '../../config/prisma';
import { getPagination, buildPagination } from '../../utils/response';
import { NotificationType, NotificationChannel } from '@prisma/client';

export class NotificationsService {
  async getMyNotifications(userId: string, page = 1, limit = 20) {
    const { skip, take } = getPagination(page, limit);
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, pagination: buildPagination(total, page, limit), unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notif) throw new Error('الإشعار غير موجود');
    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async sendNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    channel?: NotificationChannel;
    extra?: object;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        channel: data.channel || NotificationChannel.IN_APP,
        title: data.title,
        body: data.body,
        data: data.extra || {},
        sentAt: new Date(),
      },
    });
  }

  // ─── FCM Push Notification ───
  async sendPushNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const fcmKey = process.env.FCM_SERVER_KEY;
    if (!fcmKey) {
      console.warn('⚠️ FCM_SERVER_KEY not set, skipping push notification');
      return;
    }
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${fcmKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: fcmToken,
          notification: { title, body, sound: 'default' },
          data: data || {},
          priority: 'high',
        }),
      });
      const result = await response.json() as any;
      if (result.failure > 0) {
        console.error('❌ FCM push failed:', result.results);
      }
    } catch (err) {
      console.error('❌ FCM error:', err);
    }
  }

  // Register / update FCM device token for user
  async registerDeviceToken(userId: string, token: string, platform: 'android' | 'ios' | 'web'): Promise<void> {
    // Store token in Redis for quick lookup (keyed by userId)
    const redis = (await import('../../config/redis')).default;
    await redis.hset(`fcm:tokens:${userId}`, platform, token);
    await redis.expire(`fcm:tokens:${userId}`, 30 * 24 * 60 * 60); // 30 days
  }

  async getUserFcmToken(userId: string): Promise<string | null> {
    const redis = (await import('../../config/redis')).default;
    // Prefer mobile tokens
    const tokens = await redis.hgetall(`fcm:tokens:${userId}`);
    return tokens?.android || tokens?.ios || tokens?.web || null;
  }

  // Send both in-app + push
  async sendFullNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    channel?: NotificationChannel;
    extra?: object;
  }): Promise<void> {
    // In-app notification
    await this.sendNotification(data);

    // Push notification
    const fcmToken = await this.getUserFcmToken(data.userId);
    if (fcmToken) {
      await this.sendPushNotification(fcmToken, data.title, data.body, {
        type: data.type,
        ...(data.extra ? { data: JSON.stringify(data.extra) } : {}),
      });
    }
  }
}
