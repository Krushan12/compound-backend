/**
 * Price Refresh Service
 * Automatically fetches current prices from NSE and updates stock recommendations
 * Also handles automatic status transitions based on price movements
 */

import { PrismaClient } from '@prisma/client';
import { fetchNseQuote } from '../utils/nse.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Parse entry zone string to get min and max values
 * Supports formats like "650-570", "₹650-570", "650 - 570"
 */
function parseEntryZone(entryZone) {
  if (!entryZone) return null;
  
  // Remove currency symbols and extra spaces
  const cleaned = entryZone.replace(/[₹$,]/g, '').trim();
  
  // Try to match range pattern (e.g., "650-570" or "650 - 570")
  const rangeMatch = cleaned.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const val1 = parseFloat(rangeMatch[1]);
    const val2 = parseFloat(rangeMatch[2]);
    return {
      min: Math.min(val1, val2),
      max: Math.max(val1, val2),
    };
  }
  
  // Try single value
  const singleMatch = cleaned.match(/(\d+\.?\d*)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    return { min: val, max: val };
  }
  
  return null;
}

/**
 * Parse target/stop loss string to get numeric value
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[₹$,]/g, '').trim();
  const match = cleaned.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Determine new status based on current price and stock parameters
 * Logic:
 * - If price hits stop loss -> status is 'exit' (stop loss hit)
 * - If price reaches or exceeds target -> status is 'exit' (target achieved)
 * - Otherwise -> status is 'hold'
 */
function determineStatus(currentPrice, entryZone, target, stopLoss, currentStatus) {
  const entry = parseEntryZone(entryZone);
  const targetPrice = parsePrice(target);
  const stopLossPrice = parsePrice(stopLoss);
  
  if (!entry || !stopLossPrice) {
    return currentStatus; // Need at minimum entry zone & stop loss to evaluate
  }
  
  // Don't change status if already exited
    
  // Exit conditions
  if (currentPrice <= stopLossPrice) {
    return 'exit'; // Stop loss hit
  }
  if (targetPrice !== null && targetPrice !== undefined && currentPrice >= targetPrice) {
    return 'exit'; // Target achieved
  }
  
  // Within entry zone -> Entry
  if (currentPrice >= entry.min && currentPrice <= entry.max) {
    return 'entry';
  }
  
  // Otherwise, Hold (live position outside entry range)
  return 'hold';
}

/**
 * Refresh prices for all active stock recommendations
 * @returns {Promise<{updated: number, errors: number}>}
 */
export async function refreshAllPrices() {
  try {
    // Fetch all stocks to ensure exited stocks can re-enter
    const stocks = await prisma.stockRecommendation.findMany();

    let updated = 0;
    let errors = 0;

    for (const stock of stocks) {
      try {
        const symbol = stock.symbol.replace(/\.NS$/i, '');
        const nseQuote = await fetchNseQuote(symbol);

        if (nseQuote.price === null) {
          logger.warn(`No price available for ${symbol}`);
          continue;
        }

        const currentPrice = nseQuote.price;

        const targetValue = stock.target ?? stock.target1;

        const newStatus = determineStatus(
          currentPrice,
          stock.entryZone,
          targetValue,
          stock.stopLoss,
          stock.status
        );

        let realisedPct = stock.realisedPct;
        let exitedAt = stock.exitedAt;

        const wasExited = stock.status === 'exit' || stock.status === 'exited';
        const isNowActive = newStatus === 'entry' || newStatus === 'hold';

        if (wasExited && isNowActive) {
          realisedPct = null;
          exitedAt = null;
        }

        if (newStatus === 'exit' && !wasExited) {
          let avgEntry = stock.averageEntry;
          if (avgEntry === null || avgEntry === undefined) {
            const entry = parseEntryZone(stock.entryZone);
            if (entry) {
              avgEntry = (entry.min + entry.max) / 2;
            }
          }
          if (avgEntry !== null && avgEntry !== undefined && avgEntry !== 0) {
            realisedPct = parseFloat((((currentPrice - avgEntry) / avgEntry) * 100).toFixed(2));
            exitedAt = new Date();
          }
        }

        if (realisedPct !== null && realisedPct !== undefined) {
          realisedPct = parseFloat(realisedPct.toFixed(2));
        }

        await prisma.stockRecommendation.update({
          where: { id: stock.id },
          data: {
            currentPrice,
            lastPriceUpdate: new Date(),
            status: newStatus,
            realisedPct: realisedPct,
            exitedAt: exitedAt,
          },
        });

        updated++;

        if (newStatus !== stock.status) {
          const returnInfo = realisedPct !== null ? ` | Returns: ${realisedPct > 0 ? '+' : ''}${realisedPct}%` : '';
          logger.info(`Status changed for ${stock.symbol}: ${stock.status} -> ${newStatus} (Price: ₹${currentPrice}${returnInfo})`);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error updating price for ${stock.symbol}:`, error.message);
        errors++;
      }
    }

    logger.info(`Price refresh completed: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  } catch (error) {
    logger.error('Error in refreshAllPrices:', error);
    throw error;
  }
}

/**
 * Refresh price for a single stock by ID
 * @param {string} stockId - Stock recommendation ID
 * @returns {Promise<Object>} Updated stock
 */
export async function refreshStockPrice(stockId) {
  const stock = await prisma.stockRecommendation.findUnique({
    where: { id: stockId },
  });

  if (!stock) {
    throw new Error('Stock not found');
  }

  const symbol = stock.symbol.replace(/\.NS$/i, '');
  const nseQuote = await fetchNseQuote(symbol);

  if (nseQuote.price === null) {
    throw new Error('Price not available from NSE');
  }

  const currentPrice = nseQuote.price;

  const targetValue = stock.target ?? stock.target1;

  const newStatus = determineStatus(
    currentPrice,
    stock.entryZone,
    targetValue,
    stock.stopLoss,
    stock.status
  );

  let realisedPct = stock.realisedPct;
  let exitedAt = stock.exitedAt;

  const wasExited = stock.status === 'exit' || stock.status === 'exited';
  const isNowActive = newStatus === 'entry' || newStatus === 'hold';

  if (wasExited && isNowActive) {
    realisedPct = null;
    exitedAt = null;
  }

  if (newStatus === 'exit' && !wasExited) {
    let avgEntry = stock.averageEntry;
    if (avgEntry === null || avgEntry === undefined) {
      const entry = parseEntryZone(stock.entryZone);
      if (entry) {
        avgEntry = (entry.min + entry.max) / 2;
      }
    }
    if (avgEntry !== null && avgEntry !== undefined && avgEntry !== 0) {
      realisedPct = parseFloat((((currentPrice - avgEntry) / avgEntry) * 100).toFixed(2));
      exitedAt = new Date();
    }
  }

  if (realisedPct !== null && realisedPct !== undefined) {
    realisedPct = parseFloat(realisedPct.toFixed(2));
  }

  const updatedStock = await prisma.stockRecommendation.update({
    where: { id: stockId },
    data: {
      currentPrice,
      lastPriceUpdate: new Date(),
      status: newStatus,
      realisedPct: realisedPct,
      exitedAt: exitedAt,
    },
  });

  if (newStatus !== stock.status) {
    const returnInfo = realisedPct !== null ? ` | Returns: ${realisedPct > 0 ? '+' : ''}${realisedPct}%` : '';
    logger.info(`Status changed for ${stock.symbol}: ${stock.status} -> ${newStatus} (Price: ₹${currentPrice}${returnInfo})`);
  }

  return updatedStock;
}

/**
 * Move stocks from 'exit' to 'exited' after 48 hours
 * This moves stocks to Past Performance screen
 * @returns {Promise<{moved: number}>}
 */
export async function moveExitedStocksToPastPerformance() {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    // Find all stocks in 'exit' status that have been there for 48+ hours
    const stocksToMove = await prisma.stockRecommendation.findMany({
      where: {
        status: 'exit',
        exitedAt: {
          lte: fortyEightHoursAgo,
        },
      },
    });
    
    let moved = 0;
    
    for (const stock of stocksToMove) {
      await prisma.stockRecommendation.update({
        where: { id: stock.id },
        data: {
          status: 'exited',
        },
      });
      
      moved++;
      logger.info(`Moved ${stock.symbol} to Past Performance (exited) after 48 hours`);
    }
    
    if (moved > 0) {
      logger.info(`Moved ${moved} stocks from exit to exited (Past Performance)`);
    }
    
    return { moved };
  } catch (error) {
    logger.error('Error moving exited stocks to past performance:', error);
    throw error;
  }
}

/**
 * Start automatic price refresh interval
 * Runs every 5 minutes during market hours, every 30 minutes otherwise
 */
export function startPriceRefreshScheduler() {
  if (globalThis.__priceRefreshSchedulerRunning) {
    logger.warn('Price refresh scheduler already running, skipping new start');
    return;
  }

  globalThis.__priceRefreshSchedulerRunning = true;

  // Check if disabled via environment variable
  if (process.env.PRICE_REFRESH_DISABLED === 'true') {
    logger.info('Price refresh scheduler is disabled');
    globalThis.__priceRefreshSchedulerRunning = false;
    return;
  }

  const marketHoursInterval = parseInt(process.env.PRICE_REFRESH_MINUTES_MARKET) || 5;
  const offHoursInterval = parseInt(process.env.PRICE_REFRESH_MINUTES_OFF) || 30;

  function isMarketHours() {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const day = istTime.getUTCDay();
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    
    // Market hours: Monday-Friday, 9:15 AM - 3:30 PM IST
    if (day === 0 || day === 6) return false; // Weekend
    
    const totalMinutes = hours * 60 + minutes;
    const marketStart = 9 * 60 + 15; // 9:15 AM
    const marketEnd = 15 * 60 + 30; // 3:30 PM
    
    return totalMinutes >= marketStart && totalMinutes <= marketEnd;
  }

  async function runRefresh() {
    try {
      if (globalThis.__priceRefreshSchedulerPending) {
        logger.debug('Skipping price refresh run: previous run still pending');
        return;
      }

      globalThis.__priceRefreshSchedulerPending = true;
      await refreshAllPrices();
      // Also check for stocks to move to past performance
      await moveExitedStocksToPastPerformance();
    } catch (error) {
      logger.error('Scheduled price refresh failed:', error);
    } finally {
      globalThis.__priceRefreshSchedulerPending = false;
      // Schedule next run
      const interval = isMarketHours() ? marketHoursInterval : offHoursInterval;
      const delayMs = interval * 60 * 1000;
      setTimeout(runRefresh, delayMs);
      logger.info(`Next price refresh in ${interval} minutes`);
    }
  }

  // Start the scheduler
  logger.info('Starting price refresh scheduler');
  runRefresh();
}

export default {
  refreshAllPrices,
  refreshStockPrice,
  moveExitedStocksToPastPerformance,
  startPriceRefreshScheduler,
};
