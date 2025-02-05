-- DropIndex
DROP INDEX "Project_userId_title_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CutlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "width" REAL NOT NULL,
    "length" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "CutlistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CutlistItem" ("createdAt", "id", "length", "quantity", "updatedAt", "width") SELECT "createdAt", "id", "length", "quantity", "updatedAt", "width" FROM "CutlistItem";
DROP TABLE "CutlistItem";
ALTER TABLE "new_CutlistItem" RENAME TO "CutlistItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
