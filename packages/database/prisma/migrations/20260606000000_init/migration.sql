-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'scripting', 'rendering', 'ready_for_review', 'error');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('draft', 'ready');

-- CreateEnum
CREATE TYPE "VoiceProfileStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('image', 'video', 'audio');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('upload', 'generated', 'external');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ready', 'missing');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" "SceneStatus" NOT NULL DEFAULT 'draft',
    "assetId" TEXT,
    "voiceProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "samplePath" TEXT NOT NULL,
    "status" "VoiceProfileStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "source" "AssetSource" NOT NULL DEFAULT 'upload',
    "path" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'queued',
    "outputPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scene_projectId_orderIndex_key" ON "Scene"("projectId", "orderIndex");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

