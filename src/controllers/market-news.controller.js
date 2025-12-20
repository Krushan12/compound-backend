import { query } from 'express-validator';
import { success } from '../utils/response.js';
import * as MarketNewsService from '../services/market-news.service.js';
import dayjs from 'dayjs';

export const getMarketNewsValidators = [
  query('search').optional().isString(),
];

export const getMarketNews = async (req, res) => {
  const search = req.query.search;
  const news = await MarketNewsService.listMarketNews({ search });

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const mapped = await Promise.all(
    news.map(async (n) => {
      let imageUrl = n.imageUrl;

      try {
        const parsed = new URL(imageUrl);
        const isAwsS3Url = parsed.hostname.includes('amazonaws.com');

        if (isAwsS3Url) {
          const key = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
          imageUrl = `${baseUrl}/market-news/image?key=${encodeURIComponent(key)}`;
        }
      } catch (_e) {
        // ignore URL parse/signing errors and fall back to stored value
      }

      return {
        id: n.id,
        title: n.title,
        source: n.source,
        timeAgo: dayjs(n.publishedAt).format('MMM D, YYYY'),
        imageUrl,
        category: n.category,
        content: n.content,
        author: n.author || null,
        url: n.url || null,
      };
    })
  );

  return success(res, { news: mapped }, 'Market news fetched successfully');
};

export default {
  getMarketNews,
};
