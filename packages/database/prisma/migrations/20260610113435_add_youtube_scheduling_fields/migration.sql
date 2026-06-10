-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPublishAtLocal" TEXT,
ADD COLUMN     "scheduledPublishTimezone" TEXT;
