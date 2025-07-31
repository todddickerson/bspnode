-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('RTMP', 'BROWSER');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('NONE', 'RECORDING', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "recordingId" TEXT,
ADD COLUMN     "recordingStatus" "RecordingStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "streamType" "StreamType" NOT NULL DEFAULT 'RTMP';

-- CreateIndex
CREATE INDEX "Stream_streamType_idx" ON "Stream"("streamType");
