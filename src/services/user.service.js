import prisma from '../config/db.js';

export const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user;
};

export const updateProfile = async (userId, data) => {
  const user = await prisma.user.update({ where: { id: userId }, data });
  return user;
};

export const deleteAccount = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { deleted: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.kycRecord.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.subscription.deleteMany({ where: { userId } });

    const userMessages = await tx.publicChatMessage.findMany({
      where: { userId },
      select: { id: true },
    });
    const userMessageIds = userMessages.map((m) => m.id);
    if (userMessageIds.length > 0) {
      await tx.publicChatMessage.updateMany({
        where: { replyToId: { in: userMessageIds } },
        data: { replyToId: null },
      });
    }
    await tx.publicChatMessage.deleteMany({ where: { userId } });

    await tx.mobileOtp.deleteMany({ where: { mobile: user.mobile } });
    await tx.user.delete({ where: { id: userId } });
  });

  return { deleted: true };
};

export default { getProfile, updateProfile, deleteAccount };
