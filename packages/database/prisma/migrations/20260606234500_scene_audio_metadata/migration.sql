ALTER TABLE "Scene"
ADD COLUMN "audioContentHash" TEXT,
ADD COLUMN "audioDurationSeconds" DOUBLE PRECISION,
ADD COLUMN "audioGeneratedAt" TIMESTAMP(3),
ADD COLUMN "audioMimeType" TEXT,
ADD COLUMN "audioPath" TEXT;
