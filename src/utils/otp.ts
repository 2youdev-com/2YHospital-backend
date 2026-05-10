import { randomInt } from 'crypto';
import { config } from '../config/env';
import redis from '../config/redis';

const MAX_OTP_ATTEMPTS = 3;
const ATTEMPT_WINDOW_SECONDS = 5 * 60; // 5 minutes
const BLOCK_DURATION_SECONDS = 15 * 60; // 15 minutes (increased from 2min for better security)

// FIX: Use crypto.randomInt instead of Math.random for cryptographic security
export const generateOtp = (): string => {
  const length = config.otp.length;
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10).toString();
  }
  return otp;
};

export const checkOtpThrottle = async (phone: string): Promise<void> => {
  const blockKey = `otp:block:${phone}`;
  const blocked = await redis.get(blockKey);
  if (blocked) {
    const ttl = await redis.ttl(blockKey);
    const minutes = Math.ceil(ttl / 60);
    throw new Error(`تم تجاوز الحد المسموح. يرجى الانتظار ${minutes} دقيقة قبل المحاولة مجدداً`);
  }

  const countKey = `otp:send:count:${phone}`;
  const count = await redis.incr(countKey);
  if (count === 1) {
    await redis.expire(countKey, ATTEMPT_WINDOW_SECONDS);
  }
  if (count > MAX_OTP_ATTEMPTS) {
    await redis.setex(blockKey, BLOCK_DURATION_SECONDS, '1');
    await redis.del(countKey);
    throw new Error('تم تجاوز الحد المسموح لإرسال رمز التحقق. يرجى الانتظار 15 دقيقة');
  }
};

export const storeOtp = async (phone: string, otp: string): Promise<void> => {
  const key = `otp:${phone}`;
  const ttl = config.otp.expiresInMinutes * 60;
  await redis.setex(key, ttl, otp);
};

export const verifyOtp = async (phone: string, otp: string): Promise<boolean> => {
  const verifyKey = `otp:verify:fail:${phone}`;
  const blockKey = `otp:block:${phone}`;

  const blocked = await redis.get(blockKey);
  if (blocked) {
    throw new Error('الحساب موقوف مؤقتاً بسبب محاولات متعددة. يرجى الانتظار');
  }

  const key = `otp:${phone}`;
  const stored = await redis.get(key);

  if (!stored || stored !== otp) {
    const fails = await redis.incr(verifyKey);
    if (fails === 1) await redis.expire(verifyKey, ATTEMPT_WINDOW_SECONDS);
    if (fails >= MAX_OTP_ATTEMPTS) {
      await redis.setex(blockKey, BLOCK_DURATION_SECONDS, '1');
      await redis.del(verifyKey);
      await redis.del(key);
    }
    return false;
  }

  // Valid — clean up all keys
  await redis.del(key);
  await redis.del(verifyKey);
  await redis.del(`otp:send:count:${phone}`);
  return true;
};

export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 OTP for ${phone}: ${otp}`);
    return;
  }
  try {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      console.error('❌ Twilio credentials missing');
      return;
    }
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_FROM_NUMBER,
          To: phone,
          Body: `رمز التحقق الخاص بك في 2YHospital هو: ${otp}\nصالح لمدة ${config.otp.expiresInMinutes} دقائق`,
        }),
      }
    );
  } catch (err) {
    console.error('❌ SMS send failed:', err);
  }
};