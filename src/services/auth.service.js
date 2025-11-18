import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/db.js';

export const sendOtp = async (mobile) => {
  // TODO: Integrate SMS/OTP provider (e.g., Firebase, Gupshup)
  const code = '123456';
  return { mobile, code, provider: 'mock' };
};

export const verifyOtp = async (mobile, code) => {
  // Mock verification logic
  if (code !== '123456') return null;
  let user = await prisma.user.findUnique({ where: { mobile } });
  if (!user) {
    user = await prisma.user.create({ data: { mobile, kycStatus: 'NOT_STARTED' } });
  }
  const token = jwt.sign({ id: user.id, mobile: user.mobile }, env.JWT_SECRET, { expiresIn: '7d' });
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
