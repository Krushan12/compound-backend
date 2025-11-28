/*
  Warnings:

  - You are about to drop the column `referenceId` on the `MobileOtp` table. All the data in the column will be lost.
  - You are about to drop the column `verificationId` on the `MobileOtp` table. All the data in the column will be lost.
  - Added the required column `code` to the `MobileOtp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MobileOtp" DROP COLUMN "referenceId",
DROP COLUMN "verificationId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PublicChatMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;
