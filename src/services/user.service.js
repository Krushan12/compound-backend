import prisma from '../config/db.js';

export const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user;
};

export const updateProfile = async (userId, data) => {
  const user = await prisma.user.update({ where: { id: userId }, data });
  return user;
};

export default { getProfile, updateProfile };
