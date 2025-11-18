-- AlterTable
ALTER TABLE "StockRecommendation" ADD COLUMN     "currentPrice" DOUBLE PRECISION,
ADD COLUMN     "lastPriceUpdate" TIMESTAMP(3),
ADD COLUMN     "marketSymbol" TEXT;
