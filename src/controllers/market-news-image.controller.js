import { query } from 'express-validator';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import logger from '../utils/logger.js';

export const getMarketNewsImageValidators = [
  query('key').optional().isString(),
  query('url').optional().isString(),
];

function extractKeyFromUrl(url) {
  const parsed = new URL(url);
  const key = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  return key;
}

export const getMarketNewsImage = (s3Client) => async (req, res) => {
  const keyParam = req.query.key;
  const urlParam = req.query.url;

  let key = keyParam;

  if (!key && urlParam) {
    try {
      key = extractKeyFromUrl(urlParam);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid url parameter' });
    }
  }

  if (!key) {
    return res.status(400).json({ success: false, message: 'key or url is required' });
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    return res.status(500).json({ success: false, message: 'AWS_REGION is not configured' });
  }

  const bucket = process.env.MARKET_NEWS_S3_BUCKET || process.env.S3_BUCKET;
  if (!bucket) {
    return res.status(500).json({ success: false, message: 'S3_BUCKET is not configured' });
  }

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const obj = await s3Client.send(command);

    if (!obj.Body || typeof obj.Body.pipe !== 'function') {
      return res.status(500).json({ success: false, message: 'Invalid S3 object body' });
    }

    if (obj.ContentType) {
      res.setHeader('Content-Type', obj.ContentType);
    }

    if (obj.CacheControl) {
      res.setHeader('Cache-Control', obj.CacheControl);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }

    obj.Body.pipe(res);
  } catch (e) {
    const name = e?.name;
    const httpStatusCode = e?.$metadata?.httpStatusCode;
    const message = e?.message || String(e);

    logger.error('market-news.image.proxy.error', {
      key,
      bucket,
      name,
      httpStatusCode,
      error: message,
    });

    if (name === 'NoSuchKey' || httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    if (name === 'AccessDenied' || httpStatusCode === 403) {
      return res.status(403).json({ success: false, message: 'S3 access denied' });
    }

    if (
      name === 'CredentialsProviderError' ||
      /Missing credentials|Could not load credentials|credentials/i.test(message)
    ) {
      return res.status(500).json({ success: false, message: 'S3 credentials are not available' });
    }

    return res.status(502).json({ success: false, message: 'Failed to fetch image from S3' });
  }
};

export default {
  getMarketNewsImage,
  getMarketNewsImageValidators,
};
