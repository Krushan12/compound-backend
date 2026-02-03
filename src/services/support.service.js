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

export const assertChatAccess = async (userId, mobile) => {
  if (isAdminUser(mobile)) {
    return;
  }
  const subscription = await SubscriptionService.getUserSubscription(userId);
  const status = String(subscription?.status || '').toUpperCase();
  const tier = String(subscription?.tier || '').toLowerCase();
  const hasAllowedTier = tier === 'basic' || tier === 'advanced';
  if (!subscription || status !== 'ACTIVE' || !hasAllowedTier) {
    const err = new Error('1-on-1 chat is available for active Basic or Advanced subscribers');
    err.status = 403;
    throw err;
  }
};

export const listPublicChatMessages = async ({ limit = 50, userId } = {}) => {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const where = userId ? { userId } : undefined;
  const messages = await prisma.publicChatMessage.findMany({
    where,
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
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
        },
      },
    },
  });
  return messages;
};

export const listChatThreads = async () => {
  const threads = await prisma.publicChatMessage.findMany({
    where: { userId: { not: null } },
    orderBy: { createdAt: 'desc' },
    distinct: ['userId'],
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

  return threads.map((message) => ({
    userId: message.userId,
    userName: message.user?.name ?? null,
    userMobile: message.user?.mobile ?? null,
    lastMessageText: message.text,
    lastMessageAt: message.createdAt,
    lastMessageIsAdmin: message.isAdmin,
  }));
};

export const createPublicChatMessage = async (conversationUserId, mobile, text, replyToId = null) => {
  const isAdmin = isAdminUser(mobile);
  const message = await prisma.publicChatMessage.create({
    data: {
      userId: conversationUserId,
      text,
      isAdmin,
      replyToId: replyToId || null,
    },
  });
  return message;
};

export const deletePublicChatMessage = async (id) => {
  // Assumes access control is handled at controller layer
  const deleted = await prisma.publicChatMessage.delete({
    where: { id },
  });
  return deleted;
};

export default {
  isAdminUser,
  assertChatAccess,
  listPublicChatMessages,
  listChatThreads,
  createPublicChatMessage,
  deletePublicChatMessage,
};
