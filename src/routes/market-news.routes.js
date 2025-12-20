import { Router } from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { validate } from '../middlewares/validate.middleware.js';
import { getMarketNews, getMarketNewsValidators } from '../controllers/market-news.controller.js';
import { getMarketNewsImage, getMarketNewsImageValidators } from '../controllers/market-news-image.controller.js';

const router = Router();

const s3ClientConfig = {
  region: process.env.AWS_REGION,
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3Client = new S3Client(s3ClientConfig);

router.get('/', getMarketNewsValidators, validate, getMarketNews);
router.get('/image', getMarketNewsImageValidators, validate, getMarketNewsImage(s3Client));

export default router;
