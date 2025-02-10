-- Update existing null cutlistItems to empty array
UPDATE "Project" SET "cutlistItems" = '[]' WHERE "cutlistItems" IS NULL;
