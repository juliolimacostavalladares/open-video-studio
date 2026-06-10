-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "youtubePublishError" TEXT,
ADD COLUMN     "youtubeVideoId" TEXT;
