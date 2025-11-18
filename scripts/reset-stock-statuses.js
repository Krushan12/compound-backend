/**
 * Reset Stock Statuses Script
 * 
 * This script re-evaluates all stocks based on current market prices and the new status logic:
 * - Stop Loss Hit → Exit
 * - Target Achieved → Exit
 * - Otherwise → Hold
 * 
 * Also clears exitedAt for stocks that should be active again.
 */

import { PrismaClient } from '@prisma/client';
import { fetchNseQuote } from '../src/utils/nse.js';

const prisma = new PrismaClient();

/**
 * Parse entry zone string to get min and max values
 */
function parseEntryZone(entryZone) {
  if (!entryZone) return null;
  
  const cleaned = entryZone.replace(/[₹$,]/g, '').trim();
  const rangeMatch = cleaned.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  
  if (rangeMatch) {
    const val1 = parseFloat(rangeMatch[1]);
    const val2 = parseFloat(rangeMatch[2]);
    return {
      min: Math.min(val1, val2),
      max: Math.max(val1, val2),
    };
  }
  
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
 * Determine new status based on current price
 */
function determineStatus(currentPrice, entryZone, target, stopLoss) {
  const entry = parseEntryZone(entryZone);
  const targetPrice = parsePrice(target);
  const stopLossPrice = parsePrice(stopLoss);
  
  if (!entry || !targetPrice || !stopLossPrice) {
    return 'hold'; // Default to hold if we can't parse
  }
  
  // Check stop loss first (most critical)
  if (currentPrice <= stopLossPrice) {
    return 'exit'; // Stop loss hit
  }
  
  // Check if target reached
  if (currentPrice >= targetPrice) {
    return 'exit'; // Target achieved
  }
  
  // Otherwise, it's a hold (live position)
  return 'hold';
}

async function resetStockStatuses() {
  console.log('🔄 Starting stock status reset...\n');
  console.log('📋 New Logic:');
  console.log('   - Stop Loss Hit → Exit');
  console.log('   - Target Achieved → Exit');
  console.log('   - Otherwise → Hold\n');
  
  // Find all stocks (excluding truly exited ones that should stay in past performance)
  const stocks = await prisma.stockRecommendation.findMany({
    orderBy: { dateOfRec: 'desc' },
  });
  
  console.log(`Found ${stocks.length} total stocks\n`);
  console.log('='.repeat(70) + '\n');
  
  let updated = 0;
  let errors = 0;
  let skipped = 0;
  const summary = {
    toHold: 0,
    toExit: 0,
    stayExited: 0,
  };
  
  for (const stock of stocks) {
    try {
      console.log(`📊 ${stock.symbol} (${stock.companyName})`);
      console.log(`   Current Status: ${stock.status}`);
      
      // Fetch current price from NSE
      const symbol = stock.symbol.replace(/\.NS$/i, '');
      let currentPrice = stock.currentPrice;
      
      try {
        const nseQuote = await fetchNseQuote(symbol);
        if (nseQuote.price !== null) {
          currentPrice = nseQuote.price;
          console.log(`   Current Price: ₹${currentPrice} (from NSE)`);
        } else {
          console.log(`   Current Price: ₹${currentPrice || 'N/A'} (cached)`);
        }
      } catch (e) {
        console.log(`   ⚠️  Could not fetch NSE price: ${e.message}`);
        console.log(`   Current Price: ₹${currentPrice || 'N/A'} (cached)`);
      }
      
      if (!currentPrice) {
        console.log(`   ⚠️  No price available, skipping\n`);
        skipped++;
        continue;
      }
      
      // Parse entry zone, target, stop loss
      const entry = parseEntryZone(stock.entryZone);
      const targetPrice = parsePrice(stock.target1);
      const stopLossPrice = parsePrice(stock.stopLoss);
      
      if (!entry || !targetPrice || !stopLossPrice) {
        console.log(`   ⚠️  Could not parse prices, skipping\n`);
        skipped++;
        continue;
      }
      
      const avgEntry = (entry.min + entry.max) / 2;
      console.log(`   Entry Zone: ${stock.entryZone} (Avg: ₹${avgEntry})`);
      console.log(`   Target: ₹${targetPrice}`);
      console.log(`   Stop Loss: ₹${stopLossPrice}`);
      
      // Determine new status
      const newStatus = determineStatus(currentPrice, stock.entryZone, stock.target1, stock.stopLoss);
      
      // Calculate returns
      let realisedPct = null;
      let exitedAt = null;
      
      if (newStatus === 'exit') {
        // Calculate returns for exit status
        realisedPct = parseFloat((((currentPrice - avgEntry) / avgEntry) * 100).toFixed(2));
        exitedAt = new Date(); // Set exitedAt for 48-hour tracking
        console.log(`   Returns: ${realisedPct > 0 ? '+' : ''}${realisedPct}%`);
        
        if (currentPrice <= stopLossPrice) {
          console.log(`   ❌ Stop Loss Hit!`);
        } else if (currentPrice >= targetPrice) {
          console.log(`   ✅ Target Achieved!`);
        }
      } else {
        // For hold status, clear exitedAt and realisedPct (will be calculated live)
        realisedPct = null;
        exitedAt = null;
        const liveReturns = parseFloat((((currentPrice - avgEntry) / avgEntry) * 100).toFixed(2));
        console.log(`   Live Returns: ${liveReturns > 0 ? '+' : ''}${liveReturns}%`);
      }
      
      // Update stock
      await prisma.stockRecommendation.update({
        where: { id: stock.id },
        data: {
          status: newStatus,
          currentPrice,
          lastPriceUpdate: new Date(),
          realisedPct: realisedPct !== null ? realisedPct : undefined,
          exitedAt: exitedAt !== null ? exitedAt : null,
        },
      });
      
      if (stock.status !== newStatus) {
        console.log(`   🔄 Status Changed: ${stock.status} → ${newStatus}`);
        if (newStatus === 'hold') summary.toHold++;
        if (newStatus === 'exit') summary.toExit++;
      } else {
        console.log(`   ✓ Status Unchanged: ${newStatus}`);
        if (newStatus === 'exited') summary.stayExited++;
      }
      
      updated++;
      console.log('');
      
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 150));
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      errors++;
    }
  }
  
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated} stocks`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log('\n📈 Status Changes:');
  console.log(`   → Hold: ${summary.toHold} stocks`);
  console.log(`   → Exit: ${summary.toExit} stocks`);
  console.log(`   → Stayed Exited: ${summary.stayExited} stocks`);
  console.log('\n💡 Note:');
  console.log('   - Exit stocks will move to Past Performance after 48 hours');
  console.log('   - Hold stocks show live returns based on current price');
  console.log('   - Run price refresh to keep prices updated\n');
  console.log('🎉 Reset complete!\n');
}

// Run the script
resetStockStatuses()
  .catch((error) => {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
