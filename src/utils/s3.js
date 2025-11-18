/**
 * AWS S3 Utility for PDF storage
 * Handles presigned URLs for upload and download
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from './logger.js';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;

/**
 * Generate presigned URL for uploading a PDF
 * @param {string} stockId - Stock recommendation ID
 * @returns {Promise<{uploadUrl: string, key: string}>}
 */
export async function getPresignedUploadUrl(stockId) {
  const key = `stocks/${stockId}.pdf`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: 'application/pdf',
  });

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    logger.info(`Generated presigned upload URL for ${key}`);
    return { uploadUrl, key };
  } catch (error) {
    logger.error('Error generating presigned upload URL:', error);
    throw error;
  }
}

/**
 * Generate presigned URL for downloading a PDF
 * @param {string} pdfKey - S3 key of the PDF
 * @returns {Promise<string>} Presigned download URL
 */
export async function getPresignedDownloadUrl(pdfKey) {
  if (!pdfKey) {
    throw new Error('PDF key is required');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: pdfKey,
  });

  try {
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    logger.info(`Generated presigned download URL for ${pdfKey}`);
    return downloadUrl;
  } catch (error) {
    logger.error('Error generating presigned download URL:', error);
    throw error;
  }
}

/**
 * Test S3 connection
 */
export async function testS3Connection() {
  try {
    const testKey = 'test/connection.txt';
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
    });
    
    await getSignedUrl(s3Client, command, { expiresIn: 60 });
    logger.info('✅ S3 connection test successful');
    return true;
  } catch (error) {
    logger.error('❌ S3 connection test failed:', error);
    return false;
  }
}

export default {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  testS3Connection,
};
