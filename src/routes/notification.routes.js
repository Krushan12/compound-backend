import express from 'express';
import { notifyNewStock, notifyStockUpdate } from '../services/notification.service.js';

const router = express.Router();

/**
 * POST /api/notifications/new-stock
 * Send notification for new stock recommendation
 */
router.post('/new-stock', async (req, res) => {
  try {
    const { id, symbol, companyName, status } = req.body;

    if (!symbol || !companyName || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await notifyNewStock({ id, symbol, companyName, status });

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Error sending new stock notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * POST /api/notifications/stock-update
 * Send notification for stock update (status change or data update)
 */
router.post('/stock-update', async (req, res) => {
  try {
    const { id, symbol, companyName, status, oldStatus, statusChanged } = req.body;

    if (!symbol || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await notifyStockUpdate(
      { id, symbol, companyName, status }, 
      oldStatus || status,
      statusChanged !== false // Default to true if not specified
    );

    res.json({ success: true, message: 'Update notification sent' });
  } catch (error) {
    console.error('Error sending stock update notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
