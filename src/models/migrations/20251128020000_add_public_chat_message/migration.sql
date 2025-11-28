CREATE TABLE "PublicChatMessage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "text" TEXT NOT NULL,
  "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "PublicChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PublicChatMessage_createdAt_idx" ON "PublicChatMessage"("createdAt");
