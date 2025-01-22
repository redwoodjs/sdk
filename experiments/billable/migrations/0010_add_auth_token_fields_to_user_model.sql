-- AlterTable
ALTER TABLE "User" ADD COLUMN "authToken" TEXT;
ALTER TABLE "User" ADD COLUMN "authTokenExpiresAt" DATETIME;
