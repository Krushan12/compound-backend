import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Parse entry zone string to get min and max values
 * Supports formats like "650-570", "₹650-570", "650 - 570"
 */
function parseEntryZone(entryZone) {
  if (!entryZone) return null;
  
  // Remove currency symbols and extra spaces
  let cleaned = entryZone.replace(/[₹$,]/g, '').trim();
  // Normalize common range separators: en dash, em dash, and the word 'to'
  cleaned = cleaned
    .replace(/[–—]/g, '-')        // unicode dashes -> hyphen
    .replace(/\bto\b/gi, '-')   // 'to' -> hyphen
    .replace(/\s+/g, ' ');
  
  // Try to match range pattern (e.g., "650-570" or "650 - 570")
  const rangeMatch = cleaned.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const val1 = parseFloat(rangeMatch[1]);
    const val2 = parseFloat(rangeMatch[2]);
    return { min: Math.min(val1, val2), max: Math.max(val1, val2) };
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
 * Parse target/exit/stop strings to numeric value (e.g., "₹760")
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[₹$,]/g, '').trim();
  const match = cleaned.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Resolve average entry preferring explicit value; fallback to midpoint of entryZone
function resolveAverageEntry(stock) {
  let avgEntry = stock.averageEntry;
  if (typeof avgEntry === 'string') {
    const cleaned = avgEntry.replace(/[₹$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    avgEntry = Number.isFinite(parsed) ? parsed : null;
  }
  if (avgEntry === null || avgEntry === undefined || Number.isNaN(avgEntry)) {
    const entry = parseEntryZone(stock.entryZone);
    if (!entry) return null;
    avgEntry = (entry.min + entry.max) / 2;
  }
  return avgEntry;
}


/**
 * Calculate live returns for stocks that are not yet exited
 * Returns Till Date = ((Current Price - Avg Entry) / Avg Entry) * 100
 * For 'exit' and 'exited' status: use stored realisedPct
 * For 'entry' and 'hold' status: calculate live based on current price
 */
function calculateLiveReturns(stock) {
  // For exited stocks or stocks with realisedPct (exit status), use stored value
  if (stock.status === 'exited' || stock.status === 'exit') {
    return stock.realisedPct;
  }
  
  // For entry/hold stocks, calculate live returns based on current price
  // Need current price and either averageEntry or entry zone to calculate
  if (!stock.currentPrice || (!stock.averageEntry && !stock.entryZone)) {
    return null;
  }
  
  const avgEntry = resolveAverageEntry(stock);
  if (avgEntry === 0) return null;
  
  const returns = ((stock.currentPrice - avgEntry) / avgEntry) * 100;
  return parseFloat(returns.toFixed(2));
}

/**
 * Compute Potential Left = ((Target - Avg Entry)/Avg Entry) * 100
 * Uses stock.averageEntry if available; otherwise falls back to midpoint of entryZone
 */
function computePotentialLeft(stock) {
  const avgEntry = resolveAverageEntry(stock);
  if (!avgEntry || avgEntry === 0) return null;

  const target = parsePrice(stock.target1);
  if (target === null || target === undefined) return null;

  const potential = ((target - avgEntry) / avgEntry) * 100;
  return parseFloat(potential.toFixed(2));
}

/**
 * Enrich stock data with calculated live returns
 */
function enrichStockWithReturns(stock) {
  const liveReturns = calculateLiveReturns(stock);
  const potentialLeft = computePotentialLeft(stock);
  return {
    ...stock,
    realisedPct: liveReturns !== null ? liveReturns : stock.realisedPct,
    potentialPct: potentialLeft !== null ? potentialLeft : stock.potentialPct,
  };
}

/**
 * Get all stock recommendations with optional filters
 */
export const getAllStocks = async (filters = {}) => {
  const { status, search, page = 1, limit = 10 } = filters;
  
  const where = {};
  
  // Filter by status
  if (status && status !== 'all') {
    where.status = status.toLowerCase();
  }
  
  // Search by symbol or company name
  if (search) {
    where.OR = [
      { symbol: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  const skip = (page - 1) * limit;
  
  const [stocks, total] = await Promise.all([
    prisma.stockRecommendation.findMany({
      where,
      orderBy: { dateOfRec: 'desc' },
      take: limit,
      skip,
    }),
    prisma.stockRecommendation.count({ where }),
  ]);
  
  // Enrich stocks with live returns for entry/hold stocks
  const enrichedStocks = stocks.map(enrichStockWithReturns);
  
  return {
    stocks: enrichedStocks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get active stock recommendations (entry, hold, exit status)
 */
export const getActiveStocks = async () => {
  const stocks = await prisma.stockRecommendation.findMany({
    where: {
      status: {
        in: ['entry', 'hold', 'exit'],
      },
    },
    orderBy: { dateOfRec: 'desc' },
  });
  
  // Enrich stocks with live returns for entry/hold stocks
  const enrichedStocks = stocks.map(enrichStockWithReturns);
  
  return enrichedStocks;
};

/**
 * Get stock recommendation by ID
 */
export const getStockById = async (id) => {
  const stock = await prisma.stockRecommendation.findUnique({
    where: { id },
  });
  
  if (!stock) {
    throw new Error('Stock recommendation not found');
  }
  
  // Enrich with live returns if applicable
  return enrichStockWithReturns(stock);
};

/**
 * Get performance statistics
 */
export const getPerformanceStats = async () => {
  const [totalStocks, activeStocks, exitedStocks] = await Promise.all([
    prisma.stockRecommendation.count(),
    prisma.stockRecommendation.count({
      where: {
        status: {
          in: ['entry', 'hold', 'exit'],
        },
      },
    }),
    prisma.stockRecommendation.count({
      where: { status: 'exited' },
    }),
  ]);

  // Performance calculations based on all stocks with realized returns
  const stocksWithReturns = await prisma.stockRecommendation.findMany({
    where: {
      realisedPct: { not: null },
    },
    select: { realisedPct: true, stopLoss: true, entryZone: true, averageEntry: true },
  });

  const winningCalls = stocksWithReturns.filter(s => s.realisedPct > 0);
  const losingCalls = stocksWithReturns.filter(s => s.realisedPct <= 0);

  const accuracyRatio = stocksWithReturns.length > 0
    ? (winningCalls.length / stocksWithReturns.length) * 100
    : 0;

  const avgWinningReturn = winningCalls.length > 0
    ? winningCalls.reduce((sum, s) => sum + s.realisedPct, 0) / winningCalls.length
    : 0;

  const avgLosingReturn = losingCalls.length > 0
    ? losingCalls.reduce((sum, s) => sum + s.realisedPct, 0) / losingCalls.length
    : 0;

  // Calculate average downside based on stop loss
  const stocksWithStopLoss = stocksWithReturns.filter(s => s.stopLoss && s.entryZone);
  const avgDownside = stocksWithStopLoss.length > 0
    ? stocksWithStopLoss.reduce((sum, s) => {
        let avgEntry = s.averageEntry;
        if (avgEntry === null || avgEntry === undefined) {
          const entry = parseEntryZone(s.entryZone);
          if (!entry || !s.stopLoss) return sum;
          avgEntry = (entry.min + entry.max) / 2;
        }
        const downside = ((s.stopLoss - avgEntry) / avgEntry) * 100;
        return sum + downside;
      }, 0) / stocksWithStopLoss.length
    : 0;

  // Get recent winners (top 5 by returns)
  const topPerformers = await prisma.stockRecommendation.findMany({
    where: {
      realisedPct: { not: null },
    },
    orderBy: { realisedPct: 'desc' },
    take: 5,
  });
  
  return {
    totalStocks,
    activeStocks,
    exitedStocks,
    accuracyRatio: parseFloat(accuracyRatio.toFixed(2)),
    totalWinningCalls: winningCalls.length,
    avgWinningReturn: parseFloat(avgWinningReturn.toFixed(2)),
    avgLosingReturn: parseFloat(avgLosingReturn.toFixed(2)),
    avgDownside: parseFloat(avgDownside.toFixed(2)),
    topPerformers,
  };
};

/**
 * Get stocks by status
 */
export const getStocksByStatus = async (status) => {
  const stocks = await prisma.stockRecommendation.findMany({
    where: { status: status.toLowerCase() },
    orderBy: { dateOfRec: 'desc' },
  });
  
  // Enrich stocks with live returns for entry/hold/exit stocks
  const enrichedStocks = stocks.map(enrichStockWithReturns);
  
  return enrichedStocks;
};

/**
 * Update PDF key for a stock
 */
export const updatePdfKey = async (id, pdfKey) => {
  const stock = await prisma.stockRecommendation.update({
    where: { id },
    data: { pdfKey },
  });
  
  return stock;
};

export default {
  getAllStocks,
  getActiveStocks,
  getStockById,
  getPerformanceStats,
  getStocksByStatus,
  updatePdfKey,
};
