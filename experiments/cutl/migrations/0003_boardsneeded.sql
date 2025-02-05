-- update the project table to add the boardsNeeded column
ALTER TABLE "Project" ADD COLUMN "boardsNeeded" REAL NOT NULL DEFAULT 0;

-- drop the cutlistItems table, we just store the cutlistItems in the project table as json
DROP TABLE "CutlistItem";