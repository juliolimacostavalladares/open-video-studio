-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Scene" ALTER COLUMN "keywords" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VoiceProfile" ALTER COLUMN "sampleDurationSeconds" DROP DEFAULT,
ALTER COLUMN "sampleMimeType" DROP DEFAULT;
