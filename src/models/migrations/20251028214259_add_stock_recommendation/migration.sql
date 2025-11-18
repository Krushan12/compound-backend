/*
  Warnings:

  - You are about to drop the `Recommendation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stock` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('entry', 'hold', 'exit', 'exited');

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_stockId_fkey";

-- DropTable
DROP TABLE "Recommendation";

-- DropTable
DROP TABLE "Stock";

-- CreateTable
CREATE TABLE "StockRecommendation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "dateOfRec" TIMESTAMP(3) NOT NULL,
    "entryZone" TEXT NOT NULL,
    "target1" TEXT NOT NULL,
    "stopLoss" TEXT NOT NULL,
    "potentialPct" DOUBLE PRECISION NOT NULL,
    "realisedPct" DOUBLE PRECISION,
    "status" "StockStatus" NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "StockRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockRecommendation_status_dateOfRec_idx" ON "StockRecommendation"("status", "dateOfRec");
