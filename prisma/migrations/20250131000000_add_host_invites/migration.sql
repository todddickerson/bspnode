-- CreateTable
CREATE TABLE "HostInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "HostRole" NOT NULL DEFAULT 'HOST',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "streamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostInvite_token_key" ON "HostInvite"("token");

-- CreateIndex
CREATE INDEX "HostInvite_streamId_idx" ON "HostInvite"("streamId");

-- CreateIndex
CREATE INDEX "HostInvite_token_idx" ON "HostInvite"("token");

-- CreateIndex
CREATE INDEX "HostInvite_expiresAt_idx" ON "HostInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "HostInvite" ADD CONSTRAINT "HostInvite_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostInvite" ADD CONSTRAINT "HostInvite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;