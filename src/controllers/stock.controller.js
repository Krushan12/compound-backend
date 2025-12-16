import { query, param } from 'express-validator';
import { success } from '../utils/response.js';
import * as StockService from '../services/stock.service.js';
import * as PriceRefreshService from '../services/price-refresh.service.js';
import * as S3Service from '../utils/s3.js';

// Validators
export const getAllStocksValidators = [
  query('status').optional().isIn(['all', 'entry', 'hold', 'exit', 'exited']),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

export const getStockByIdValidators = [
  param('id').isString().notEmpty(),
];

export const getStocksByStatusValidators = [
  param('status').isIn(['entry', 'hold', 'exit', 'exited']),
];

// Controllers
export const getAllStocks = async (req, res) => {
  const userId = req.user?.id;
  const filters = {
    userId,
    status: req.query.status,
    search: req.query.search,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
  };
  
  const result = await StockService.getAllStocks(filters);
  return success(res, result, 'Stocks fetched successfully');
};

export const getActiveStocks = async (req, res) => {
  const userId = req.user?.id;
  const stocks = await StockService.getActiveStocks({ userId });
  return success(res, { stocks }, 'Active stocks fetched successfully');
};

export const getStockById = async (req, res) => {
  const userId = req.user?.id;
  const stock = await StockService.getStockById(req.params.id, { userId });
  return success(res, { stock }, 'Stock fetched successfully');
};

export const getPerformanceStats = async (req, res) => {
  const stats = await StockService.getPerformanceStats();
  return success(res, stats, 'Performance stats fetched successfully');
};

export const getStocksByStatus = async (req, res) => {
  const userId = req.user?.id;
  const stocks = await StockService.getStocksByStatus(req.params.status, { userId });
  return success(res, { stocks }, `${req.params.status} stocks fetched successfully`);
};

export const refreshAllPrices = async (req, res) => {
  const result = await PriceRefreshService.refreshAllPrices();
  return success(res, result, 'Prices refreshed successfully');
};

export const refreshStockPrice = async (req, res) => {
  const stock = await PriceRefreshService.refreshStockPrice(req.params.id);
  return success(res, { stock }, 'Stock price refreshed successfully');
};

/**
 * Get presigned upload URL for PDF (Admin only)
 */
export const getPdfUploadUrl = async (req, res) => {
  const { uploadUrl, key } = await S3Service.getPresignedUploadUrl(req.params.id);
  return success(res, { uploadUrl, key }, 'Presigned upload URL generated');
};

/**
 * Save PDF key after upload (Admin only)
 */
export const savePdfKey = async (req, res) => {
  const { pdfKey } = req.body;
  const stock = await StockService.updatePdfKey(req.params.id, pdfKey);
  return success(res, { stock }, 'PDF key saved successfully');
};

/**
 * Get presigned download URL for PDF (User)
 */
export const getPdfDownloadUrl = async (req, res) => {
  const stock = await StockService.getStockById(req.params.id);
  
  if (!stock.pdfKey) {
    return res.status(404).json({
      success: false,
      message: 'No PDF available for this stock',
    });
  }
  
  const downloadUrl = await S3Service.getPresignedDownloadUrl(stock.pdfKey);
  return success(res, { downloadUrl }, 'Presigned download URL generated');
};

export const pdfValidators = [
  param('id').isString().notEmpty(),
];

export default {
  getAllStocks,
  getActiveStocks,
  getStockById,
  getPerformanceStats,
  getStocksByStatus,
  refreshAllPrices,
  refreshStockPrice,
  getPdfUploadUrl,
  savePdfKey,
  getPdfDownloadUrl,
};
