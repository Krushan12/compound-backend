/*
  Warnings:

  - You are about to drop the column `referenceId` on the `MobileOtp` table. All the data in the column will be lost.
  - You are about to drop the column `verificationId` on the `MobileOtp` table. All the data in the column will be lost.
  - Added the required column `code` to the `MobileOtp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MobileOtp" DROP COLUMN IF EXISTS "referenceId",
DROP COLUMN IF EXISTS "verificationId",
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PublicChatMessage'
  ) THEN
    ALTER TABLE "PublicChatMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
