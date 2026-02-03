import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import env from '../config/env.js';
import prisma from '../config/db.js';

const DEMO_MOBILE = '9999999999';
const DEMO_OTP = '123456';

// Expired-subscription demo account for App Store review
const EXPIRED_DEMO_MOBILE = '8888888888';
const EXPIRED_DEMO_OTP = '654321';

const refreshTokenTtlMs = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

const createAccessToken = (user) =>
  jwt.sign({ id: user.id, mobile: user.mobile }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  });

const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createRefreshToken = async (userId) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  return refreshToken;
};

export const issueTokensForUser = async (user) => {
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    token: accessToken,
  };
};

export const refreshSession = async (refreshToken) => {
  if (!refreshToken) return null;
  const tokenHash = hashRefreshToken(String(refreshToken));
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: { subscription: true },
  });
  if (!user) return null;

  const tokens = await issueTokensForUser(user);
  return { user, ...tokens };
};

export const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(String(refreshToken));
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// Generate a 6-digit OTP code
const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Send OTP using MSG91 Flow API
export const sendOtp = async (mobile) => {
  const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

  if (normalizedMobile === DEMO_MOBILE || normalizedMobile === EXPIRED_DEMO_MOBILE) {
    const otpCode = normalizedMobile === DEMO_MOBILE ? DEMO_OTP : EXPIRED_DEMO_OTP;

    await prisma.mobileOtp.upsert({
      where: { mobile: normalizedMobile },
      update: {
        code: otpCode,
        provider: 'demo',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
      create: {
        mobile: normalizedMobile,
        code: otpCode,
        provider: 'demo',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { mobile: normalizedMobile, provider: 'demo' };
  }

  const baseUrl = env.MSG91_BASE_URL || 'https://control.msg91.com/api/v5';
  const authKey = env.MSG91_AUTH_KEY;
  const flowId = env.MSG91_OTP_FLOW_ID;
  const senderId = env.MSG91_SENDER_ID;

  if (!authKey || !flowId || !senderId) {
    throw new Error('MSG91 OTP is not configured');
  }

  const otpCode = generateOtpCode();

  try {
    const url = `${baseUrl}/flow/`;

    const payload = {
      flow_id: flowId,
      sender: senderId,
      recipients: [
        {
          mobiles: `91${normalizedMobile}`,
          OTP: otpCode, // For templates that use {{OTP}}
          VAR1: otpCode, // For templates that use {{VAR1}}
          number: otpCode, // For templates created from DLT placeholder ##number##
        },
      ],
    };

    const response = await axios.post(url, payload, {
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data || {};

    if (data.type !== 'success') {
      throw new Error(data.message || 'MSG91 send OTP failed');
    }

    // Store OTP locally for verification
    await prisma.mobileOtp.upsert({
      where: { mobile: normalizedMobile },
      update: {
        code: otpCode,
        provider: 'msg91',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
      },
      create: {
        mobile: normalizedMobile,
        code: otpCode,
        provider: 'msg91',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { mobile: normalizedMobile, provider: 'msg91' };
  } catch (err) {
    throw new Error(`Failed to send OTP via MSG91: ${err?.response?.data?.message || err.message}`);
  }
};

// Verify OTP locally and sign user in
export const verifyOtp = async (mobile, code) => {
  const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

  const record = await prisma.mobileOtp.findUnique({ where: { mobile: normalizedMobile } });
  if (!record) return null;

  // Check expiry
  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  const inputCode = String(code).trim();

  if (record.code !== inputCode) {
    // Increment attempts on wrong code
    await prisma.mobileOtp.update({
      where: { mobile: normalizedMobile },
      data: { attempts: record.attempts + 1 },
    });
    return null;
  }

  // Successful verification: clean up OTP record
  try {
    await prisma.mobileOtp.delete({ where: { mobile: normalizedMobile } });
  } catch (_e) {
    // ignore if already deleted
  }

  // Reuse existing signInWithMobile logic
  const authPayload = await signInWithMobile(normalizedMobile);
  return authPayload;
};

export const emailSignin = async (userId, email) => {
  const user = await prisma.user.update({ where: { id: userId }, data: { email } });
  return user;
};

export const signInWithMobile = async (mobile) => {
  let user = await prisma.user.findUnique({
    where: { mobile },
    include: { subscription: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { mobile, kycStatus: 'NOT_STARTED' },
      include: { subscription: true },
    });
  }

  // For the expired-demo test account, ensure there is an EXPIRED subscription
  if (mobile === EXPIRED_DEMO_MOBILE) {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const expiresAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday

    let subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          status: 'EXPIRED',
          plan: 'monthly',
          amount: 0,
          tier: 'advanced',
          startedAt,
          expiresAt,
        },
      });
    } else if (subscription.status !== 'EXPIRED') {
      subscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: 'EXPIRED',
          expiresAt: subscription.expiresAt && subscription.expiresAt < now ? subscription.expiresAt : expiresAt,
        },
      });
    }

    user = { ...user, subscription };
  }

  const tokens = await issueTokensForUser(user);
  return { user, ...tokens };
};

export default {
  sendOtp,
  verifyOtp,
  emailSignin,
  refreshSession,
  revokeRefreshToken,
  issueTokensForUser,
};

