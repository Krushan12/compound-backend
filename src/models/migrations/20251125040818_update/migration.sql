-- CreateTable
CREATE TABLE "MobileOtp" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mobile" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "referenceId" INTEGER,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MobileOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileOtp_mobile_key" ON "MobileOtp"("mobile");
