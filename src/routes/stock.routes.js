import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import auth, { optionalAuth } from '../middlewares/auth.middleware.js';
import {
  getAllStocks,
  getAllStocksValidators,
  getActiveStocks,
  getStockById,
  getStockByIdValidators,
  getPerformanceStats,
  getStocksByStatus,
  getStocksByStatusValidators,
  refreshAllPrices,
  refreshStockPrice,
  getPdfUploadUrl,
  savePdfKey,
  getPdfDownloadUrl,
  pdfValidators,
} from '../controllers/stock.controller.js';

const router = Router();

/**
 * @swagger
 * /stocks:
 *   get:
 *     summary: Get all stock recommendations
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, entry, hold, exit, exited]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stocks fetched successfully
 */
router.get('/', auth, getAllStocksValidators, validate, getAllStocks);

/**
 * @swagger
 * /stocks/active:
 *   get:
 *     summary: Get active stock recommendations
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active stocks fetched successfully
 */
router.get('/active', optionalAuth, getActiveStocks);

/**
 * @swagger
 * /stocks/performance:
 *   get:
 *     summary: Get performance statistics
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance stats fetched successfully
 */
router.get('/performance', optionalAuth, getPerformanceStats);

/**
 * @swagger
 * /stocks/status/{status}:
 *   get:
 *     summary: Get stocks by status
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [entry, hold, exit, exited]
 *     responses:
 *       200:
 *         description: Stocks fetched successfully
 */
router.get('/status/:status', optionalAuth, getStocksByStatusValidators, validate, getStocksByStatus);

/**
 * @swagger
 * /stocks/refresh:
 *   post:
 *     summary: Refresh prices for all active stocks
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prices refreshed successfully
 */
router.post('/refresh', auth, refreshAllPrices);

/**
 * @swagger
 * /stocks/{id}/refresh:
 *   post:
 *     summary: Refresh price for a specific stock
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stock price refreshed successfully
 */
router.post('/:id/refresh', auth, getStockByIdValidators, validate, refreshStockPrice);

/**
 * @swagger
 * /stocks/{id}/pdf/upload-url:
 *   get:
 *     summary: Get presigned URL for PDF upload (Admin only)
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presigned upload URL generated
 */
router.get('/:id/pdf/upload-url', auth, pdfValidators, validate, getPdfUploadUrl);

/**
 * @swagger
 * /stocks/{id}/pdf/save-key:
 *   post:
 *     summary: Save PDF key after upload (Admin only)
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pdfKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF key saved successfully
 */
router.post('/:id/pdf/save-key', auth, pdfValidators, validate, savePdfKey);

/**
 * @swagger
 * /stocks/{id}/pdf-url:
 *   get:
 *     summary: Get presigned download URL for PDF
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presigned download URL generated
 *       404:
 *         description: No PDF available
 */
router.get('/:id/pdf-url', auth, pdfValidators, validate, getPdfDownloadUrl);

/**
 * @swagger
 * /stocks/{id}:
 *   get:
 *     summary: Get stock recommendation by ID
 *     tags: [Stocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stock fetched successfully
 *       404:
 *         description: Stock not found
 */
router.get('/:id', auth, getStockByIdValidators, validate, getStockById);

export default router;
