/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `Channel` table. All the data in the column will be lost.
  - Added the required column `encryptedAccessToken` to the `Channel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "accessToken",
DROP COLUMN "refreshToken",
ADD COLUMN     "encryptedAccessToken" TEXT NOT NULL,
ADD COLUMN     "encryptedRefreshToken" TEXT;
