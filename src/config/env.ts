import dotenv from 'dotenv';
dotenv.config();

// FIX: Validate critical environment variables at startup
// This prevents silent failures in production with wrong/missing config
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return val || '';
}

function requireSecret(key: string, fallback: string): string {
  const val = process.env[key];
  if (!val) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`❌ Missing required secret: ${key}`);
    }
    // FIX: Warn loudly in development instead of silently using weak fallbacks
    console.warn(`⚠️  ${key} not set, using insecure development fallback. DO NOT use in production.`);
    return fallback;
  }
  return val;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  jwt: {
    // FIX: Remove weak hardcoded fallbacks in production
    accessSecret: requireSecret('JWT_ACCESS_SECRET', 'dev_access_secret_do_not_use_in_prod'),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET', 'dev_refresh_secret_do_not_use_in_prod'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    url: process.env.REDIS_URL || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '5', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_FROM_NUMBER || '',
  },

  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o',
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3001').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};