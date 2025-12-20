import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const listMarketNews = async ({ search } = {}) => {
  const where = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { source: { contains: search, mode: 'insensitive' } },
    ];
  }

  const news = await prisma.marketNews.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
  });

  return news;
};

export default {
  listMarketNews,
};
