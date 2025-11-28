import prisma from '../config/db.js';
import env from '../config/env.js';
import * as SubscriptionService from './subscription.service.js';

// Normalize mobile to last 10 digits for comparison
const normalizeMobile = (mobile) => {
  if (!mobile) return null;
  return String(mobile).replace(/\D/g, '').slice(-10) || null;
};

// Determine if a given mobile belongs to an admin user based on env config
const getAdminMobiles = () => {
  const raw = env.SUPPORT_ADMIN_MOBILES || '';
  return raw
    .split(',')
    .map((m) => normalizeMobile(m))
    .filter((m) => !!m);
};

const adminMobiles = getAdminMobiles();

export const isAdminUser = (mobile) => {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return false;
  return adminMobiles.includes(normalized);
};

export const assertAdvancedAccess = async (userId) => {
  const subscription = await SubscriptionService.getUserSubscription(userId);
  if (!subscription || subscription.status !== 'ACTIVE' || subscription.tier !== 'advanced') {
    const err = new Error('Priority chat is available only for Advanced subscribers');
    err.status = 403;
    throw err;
  }
};

export const listPublicChatMessages = async ({ limit = 50 } = {}) => {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const messages = await prisma.publicChatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: safeLimit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobile: true,
        },
      },
    },
  });
  return messages;
};

export const createPublicChatMessage = async (userId, mobile, text) => {
  const isAdmin = isAdminUser(mobile);
  const message = await prisma.publicChatMessage.create({
    data: {
      userId,
      text,
      isAdmin,
    },
  });
  return message;
};

export default { isAdminUser, assertAdvancedAccess, listPublicChatMessages, createPublicChatMessage };
