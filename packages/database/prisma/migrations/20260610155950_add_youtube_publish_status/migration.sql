-- CreateEnum
CREATE TYPE "YoutubePublishStatus" AS ENUM ('idle', 'uploading', 'processing', 'scheduled', 'published', 'error', 'download_only');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "youtubePublishStatus" "YoutubePublishStatus" NOT NULL DEFAULT 'idle';
