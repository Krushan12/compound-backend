import jwt from 'jsonwebtoken';
import axios from 'axios';
import env from '../config/env.js';
import prisma from '../config/db.js';

// Generate a 6-digit OTP code
const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Send OTP using MSG91 Flow API
export const sendOtp = async (mobile) => {
  const normalizedMobile = String(mobile).replace(/\D/g, '').slice(-10);

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
  const { user, token } = await signInWithMobile(normalizedMobile);
  return { user, token };
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

