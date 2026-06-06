-- AlterTable: adiciona rawScript ao Project para persistência do editor de roteiro
ALTER TABLE "Project" ADD COLUMN "rawScript" TEXT;
