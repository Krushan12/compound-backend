import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseReturns(value) {
  if (!value) return 0;
  const cleaned = String(value).replace('%', '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDateOfCoverage(raw, year) {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;
  const composed = `${cleaned} ${year}`;
  const d = new Date(composed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function main() {
  const csvPath = path.resolve(__dirname, '../../Stock Data - Live Stocks.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at', csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const currentYear = new Date().getFullYear();

  let created = 0;
  let skipped = 0;

  for (const row of records) {
    const companyName = (row['Stock Name'] || '').toString().trim();
    const symbolRaw = (row['Ticker'] || '').toString().trim();

    if (!companyName || !symbolRaw) {
      skipped += 1;
      continue;
    }

    const symbol = symbolRaw.toUpperCase();

    const potentialPct = parseReturns(row['Returns']);

    const dateOfRecRaw = row['Date of Coverage '] || row['Date of Coverage'];
    let dateOfRec = parseDateOfCoverage(dateOfRecRaw, currentYear);
    if (!dateOfRec) {
      dateOfRec = new Date();
    }

    const entryMin = parseNumber(row['Entry Min']);
    const entryMax = parseNumber(row['Entry Max']);

    if (entryMin === null || entryMax === null) {
      skipped += 1;
      continue;
    }

    const entryZone = `${entryMin} - ${entryMax}`;

    const target1 = (row['Target'] ?? '').toString().trim();
    const stopLoss = (row['Stoploss/Exit Price'] ?? '').toString().trim();

    const startOfDay = new Date(dateOfRec);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateOfRec);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.stockRecommendation.findFirst({
      where: {
        symbol,
        companyName,
        status: 'entry',
        dateOfRec: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.stockRecommendation.create({
      data: {
        symbol,
        companyName,
        dateOfRec,
        entryZone,
        target1,
        stopLoss,
        potentialPct,
        realisedPct: null,
        status: 'entry',
        pdfUrl: null,
        pdfKey: null,
        currentPrice: null,
        lastPriceUpdate: null,
        exitedAt: null,
      },
    });

    created += 1;
  }

  const pastCsvPath = path.resolve(__dirname, '../../stockdatapast.csv');
  if (fs.existsSync(pastCsvPath)) {
    const pastContent = fs.readFileSync(pastCsvPath, 'utf8');

    const pastRecords = parse(pastContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const row of pastRecords) {
      const companyName = (row['Stock Name'] || '').toString().trim();
      const symbolRaw = (row['Ticker'] || '').toString().trim();

      if (!companyName || !symbolRaw) {
        skipped += 1;
        continue;
      }

      const symbol = symbolRaw.toUpperCase();

      const returnsPct = parseReturns(row['Returns']);

      const dateOfRecRaw = row['Date of Coverage '] || row['Date of Coverage'];
      const dateOfClosureRaw = row['Date of Closure'];

      let dateOfRec = parseDateOfCoverage(dateOfRecRaw, currentYear);
      if (!dateOfRec) {
        dateOfRec = new Date();
      }

      let exitedAt = parseDateOfCoverage(dateOfClosureRaw, currentYear);
      if (!exitedAt) {
        exitedAt = dateOfRec;
      }

      const entryMin = parseNumber(row['Entry Min']);
      const entryMax = parseNumber(row['Entry Max']);

      if (entryMin === null || entryMax === null) {
        skipped += 1;
        continue;
      }

      const entryZone = `${entryMin} - ${entryMax}`;

      const exitPrice = (row['Stoploss/Exit Price'] ?? '').toString().trim();

      const startOfDay = new Date(dateOfRec);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateOfRec);
      endOfDay.setHours(23, 59, 59, 999);

      const existingExited = await prisma.stockRecommendation.findFirst({
        where: {
          symbol,
          companyName,
          status: 'exited',
          dateOfRec: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (existingExited) {
        skipped += 1;
        continue;
      }

      await prisma.stockRecommendation.create({
        data: {
          symbol,
          companyName,
          dateOfRec,
          entryZone,
          target1: exitPrice,
          stopLoss: exitPrice,
          potentialPct: returnsPct,
          realisedPct: returnsPct,
          status: 'exited',
          pdfUrl: null,
          pdfKey: null,
          currentPrice: null,
          lastPriceUpdate: null,
          exitedAt,
        },
      });

      created += 1;
    }
  } else {
    console.warn('Past CSV file not found at', pastCsvPath, '- skipping exited stocks import');
  }

  console.log('Import complete');
  console.log('Created:', created);
  console.log('Skipped:', skipped);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
