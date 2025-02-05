-- RedefineTables
-- add cutlistItems to project
ALTER TABLE "Project" ADD COLUMN "cutlistItems" JSONB;
