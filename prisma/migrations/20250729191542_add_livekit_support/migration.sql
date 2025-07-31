-- CreateEnum
CREATE TYPE "HostRole" AS ENUM ('OWNER', 'HOST', 'GUEST');

-- AlterEnum
ALTER TYPE "StreamType" ADD VALUE 'LIVEKIT';

-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "liveKitRoomId" TEXT,
ADD COLUMN     "liveKitRoomName" TEXT,
ADD COLUMN     "maxHosts" INTEGER DEFAULT 4;

-- CreateTable
CREATE TABLE "StreamHost" (
    "id" TEXT NOT NULL,
    "role" "HostRole" NOT NULL DEFAULT 'HOST',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "StreamHost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamHost_streamId_idx" ON "StreamHost"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamHost_userId_streamId_key" ON "StreamHost"("userId", "streamId");

-- AddForeignKey
ALTER TABLE "StreamHost" ADD CONSTRAINT "StreamHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamHost" ADD CONSTRAINT "StreamHost_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
