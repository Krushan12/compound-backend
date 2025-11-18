# Backend Scripts

## reset-stock-statuses.js

### Purpose
Re-evaluates all stocks in the database based on current market prices and the new status logic.

### What It Does
1. Fetches all stocks from the database
2. Gets current price from NSE for each stock
3. Determines new status based on:
   - **Stop Loss Hit** (price ≤ stop loss) → `exit`
   - **Target Achieved** (price ≥ target) → `exit`
   - **Otherwise** → `hold`
4. For `exit` stocks:
   - Calculates and stores `realisedPct`
   - Sets `exitedAt` timestamp (for 48-hour tracking)
5. For `hold` stocks:
   - Clears `realisedPct` (will be calculated live)
   - Clears `exitedAt`
6. Updates `currentPrice` and `lastPriceUpdate`

### When to Use
- After implementing new status logic
- When stocks are incorrectly showing in Past Performance
- To reset all stocks to correct status based on current market conditions
- After database migrations or bulk updates

### How to Run

```bash
cd backend
npm run script:reset-statuses
```

Or directly:
```bash
cd backend
node scripts/reset-stock-statuses.js
```

### Prerequisites
- `.env` file with `DATABASE_URL` configured
- Internet connection (to fetch NSE prices)
- Prisma client generated (`npm run prisma:generate`)

### Output Example
```
🔄 Starting stock status reset...

📋 New Logic:
   - Stop Loss Hit → Exit
   - Target Achieved → Exit
   - Otherwise → Hold

Found 25 total stocks

======================================================================

📊 RELIANCE (Reliance Industries Limited)
   Current Status: exited
   Current Price: ₹2,450 (from NSE)
   Entry Zone: 2300-2350 (Avg: ₹2325)
   Target: ₹2,600
   Stop Loss: ₹2,200
   Live Returns: +5.38%
   🔄 Status Changed: exited → hold

📊 TCS (Tata Consultancy Services)
   Current Status: exited
   Current Price: ₹3,800 (from NSE)
   Entry Zone: 3500-3550 (Avg: ₹3525)
   Target: ₹3,900
   Stop Loss: ₹3,400
   ✅ Target Achieved!
   Returns: +7.80%
   🔄 Status Changed: exited → exit

======================================================================

📊 Summary:
   ✅ Updated: 25 stocks
   ❌ Errors: 0
   ⏭️  Skipped: 0

📈 Status Changes:
   → Hold: 18 stocks
   → Exit: 5 stocks
   → Stayed Exited: 2 stocks

💡 Note:
   - Exit stocks will move to Past Performance after 48 hours
   - Hold stocks show live returns based on current price
   - Run price refresh to keep prices updated

🎉 Reset complete!
```

### Important Notes
- **Rate Limiting**: Script includes 150ms delay between NSE API calls to avoid rate limiting
- **Price Fetching**: If NSE fetch fails, uses cached `currentPrice` from database
- **Skipped Stocks**: Stocks without prices or unparseable data are skipped
- **Exited Status**: Stocks already in `exited` status are also re-evaluated
- **48-Hour Rule**: Exit stocks will automatically move to `exited` after 48 hours via the price refresh scheduler

### After Running
1. Restart your backend server to ensure scheduler picks up changes
2. Check the Dashboard in the Flutter app - you should see stocks in Entry/Hold/Exit tabs
3. Past Performance will only show stocks that are truly `exited`
4. The price refresh scheduler will continue to update prices and statuses automatically

### Troubleshooting

**No stocks updated:**
- Check database connection in `.env`
- Verify Prisma client is generated
- Check if stocks exist in database

**NSE fetch errors:**
- Normal for some stocks (delisted, suspended, etc.)
- Script will use cached prices if available
- Check internet connection

**All stocks still in Past Performance:**
- Wait a few seconds and refresh the app
- Check if backend server is running with new code
- Verify the script completed successfully

## fix-exit-stocks.js (Legacy)

**⚠️ DEPRECATED** - This script was used with the old logic that immediately moved exit stocks to exited status. Use `reset-stock-statuses.js` instead.
