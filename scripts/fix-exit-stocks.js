/**
 * Migration Script: Fix stocks in 'exit' status
 * 
 * This script:
 * 1. Finds all stocks with status 'exit'
 * 2. Calculates their returns (rounded to 2 decimals)
 * 3. Changes status to 'exited' so they move to Past Performance
 * 4. Rounds any existing realisedPct to 2 decimals
 */

import { PrismaClient } from '@prisma/client';

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

async function fixExitStocks() {
  console.log('🔍 Finding stocks in "exit" status...\n');
  
  // Find all stocks with status 'exit'
  const exitStocks = await prisma.stockRecommendation.findMany({
    where: {
      status: 'exit'
    }
  });
  
  console.log(`Found ${exitStocks.length} stocks in "exit" status\n`);
  
  if (exitStocks.length === 0) {
    console.log('✅ No stocks to fix!\n');
    
    // Also check for stocks with unrounded returns
    console.log('🔍 Checking for stocks with unrounded returns...\n');
    
    const allStocks = await prisma.stockRecommendation.findMany({
      where: {
        realisedPct: {
          not: null
        }
      }
    });
    
    let roundedCount = 0;
    
    for (const stock of allStocks) {
      const rounded = parseFloat(stock.realisedPct.toFixed(2));
      
      if (rounded !== stock.realisedPct) {
        console.log(`📊 ${stock.symbol}: ${stock.realisedPct}% → ${rounded}%`);
        
        await prisma.stockRecommendation.update({
          where: { id: stock.id },
          data: {
            realisedPct: rounded
          }
        });
        
        roundedCount++;
      }
    }
    
    console.log(`\n✅ Rounded ${roundedCount} stocks' returns to 2 decimals\n`);
    return;
  }
  
  let fixed = 0;
  let errors = 0;
  
  for (const stock of exitStocks) {
    try {
      console.log(`\n📈 Processing: ${stock.symbol}`);
      console.log(`   Current Price: ₹${stock.currentPrice}`);
      console.log(`   Entry Zone: ${stock.entryZone}`);
      console.log(`   Current Status: ${stock.status}`);
      
      // Calculate returns
      const entry = parseEntryZone(stock.entryZone);
      
      if (!entry) {
        console.log(`   ⚠️  Could not parse entry zone`);
        errors++;
        continue;
      }
      
      const avgEntry = (entry.min + entry.max) / 2;
      const currentPrice = stock.currentPrice || avgEntry;
      const realisedPct = parseFloat((((currentPrice - avgEntry) / avgEntry) * 100).toFixed(2));
      
      console.log(`   Average Entry: ₹${avgEntry}`);
      console.log(`   Calculated Returns: ${realisedPct > 0 ? '+' : ''}${realisedPct}%`);
      
      // Update to 'exited' status
      await prisma.stockRecommendation.update({
        where: { id: stock.id },
        data: {
          status: 'exited',
          realisedPct: realisedPct
        }
      });
      
      console.log(`   ✅ Changed status to "exited"`);
      fixed++;
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Fixed ${fixed} stocks`);
  console.log(`❌ Errors: ${errors}`);
  console.log('\n📊 Summary:');
  console.log(`   - Stocks moved to Past Performance: ${fixed}`);
  console.log(`   - Returns calculated and rounded to 2 decimals`);
  console.log('\n🎉 Migration complete!\n');
}

// Run the script
fixExitStocks()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
