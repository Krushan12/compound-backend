import jwt from 'jsonwebtoken';
import axios from 'axios';
import env from '../config/env.js';
import prisma from '../config/db.js';

// Send OTP using Cashfree Mobile 360 API
export const sendOtp = async (mobile) => {
  const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

  const baseUrl = env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/verification';
  const clientId = env.CASHFREE_CLIENT_ID;
  const clientSecret = env.CASHFREE_CLIENT_SECRET;
  const apiVersion = env.CASHFREE_API_VERSION || '2024-12-01';

  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials are not configured');
  }

  try {
    const url = `${baseUrl}/mobile360/otp/send`;

    // Generate our own verification_id so we can reuse it for verify
    const verificationId = `login-${normalizedMobile}-${Date.now()}`;

    const payload = {
      verification_id: verificationId,
      mobile_number: normalizedMobile,
      name: 'Rainbow Money User',
      user_consent: {
        timestamp: new Date().toISOString(),
        purpose: 'User consent to receive OTP for Rainbow Money login.',
        obtained: true,
        type: 'EXPLICIT',
      },
      notification_modes: ['SMS'],
    };

    const response = await axios.post(url, payload, {
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': apiVersion,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data || {};

    // Temporary debug log to inspect Cashfree verify OTP response shape
    // Remove or downgrade to proper logger in production if too noisy
    console.log('Cashfree verify OTP response:', JSON.stringify(data));

    if (!data.verification_id) {
      throw new Error('Cashfree send OTP did not return verification_id');
    }

    await prisma.mobileOtp.upsert({
      where: { mobile: normalizedMobile },
      update: {
        verificationId: data.verification_id,
        referenceId: data.reference_id ?? null,
        provider: 'cashfree',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes validity
      },
      create: {
        mobile: normalizedMobile,
        verificationId: data.verification_id,
        referenceId: data.reference_id ?? null,
        provider: 'cashfree',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { mobile: normalizedMobile, provider: 'cashfree' };
  } catch (err) {
    throw new Error(`Failed to send OTP via Cashfree: ${err?.response?.data?.message || err.message}`);
  }
};

// Verify OTP using Cashfree Mobile 360 API and sign user in
export const verifyOtp = async (mobile, code) => {
  const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

  const baseUrl = env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/verification';
  const clientId = env.CASHFREE_CLIENT_ID;
  const clientSecret = env.CASHFREE_CLIENT_SECRET;
  const apiVersion = env.CASHFREE_API_VERSION || '2024-12-01';

  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials are not configured');
  }

  // Fetch latest OTP request for this mobile
  const record = await prisma.mobileOtp.findUnique({ where: { mobile: normalizedMobile } });
  if (!record || !record.verificationId) {
    return null;
  }

  // Optional: check expiry locally first
  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  try {
    const url = `${baseUrl}/mobile360/otp/verify`;

    const payload = {
      verification_id: record.verificationId,
      otp: String(code).trim(),
    };

    const response = await axios.post(url, payload, {
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': apiVersion,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data || {};

    // Debug log: inspect verify OTP response from Cashfree when OTP appears "invalid"
    console.log('Cashfree verify OTP response:', JSON.stringify(data));

    if (data.status !== 'SUCCESS') {
      return null;
    }

    // OTP verified, sign in or create user
    let user = await prisma.user.findUnique({
      where: { mobile: normalizedMobile },
      include: { subscription: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { mobile: normalizedMobile, kycStatus: 'NOT_STARTED' },
        include: { subscription: true },
      });
    }

    const token = jwt.sign(
      { id: user.id, mobile: user.mobile },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return { user, token };
  } catch (err) {
    // If Cashfree verification fails, treat as invalid OTP
    return null;
  }
};

export const emailSignin = async (userId, email) => {
  const user = await prisma.user.update({ where: { id: userId }, data: { email } });
  return user;
};

export const signInWithMobile = async (mobile) => {
  let user = await prisma.user.findUnique({ 
    where: { mobile },
    include: { subscription: true }
  });
  if (!user) {
    user = await prisma.user.create({ 
      data: { mobile, kycStatus: 'NOT_STARTED' },
      include: { subscription: true }
    });
  }
  const token = jwt.sign({ id: user.id, mobile: user.mobile }, env.JWT_SECRET, { expiresIn: '7d' });
  return { user, token };
};

export default { sendOtp, verifyOtp, emailSignin };

