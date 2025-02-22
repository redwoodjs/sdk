-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL DEFAULT 1,
    "salaryMin" TEXT,
    "salaryMax" TEXT,
    "dateApplied" DATETIME,
    "jobTitle" TEXT,
    "jobDescription" TEXT,
    "postingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ApplicationStatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("archived", "companyId", "createdAt", "dateApplied", "id", "jobDescription", "jobTitle", "postingUrl", "salaryMax", "salaryMin", "statusId", "updatedAt", "userId") SELECT "archived", "companyId", "createdAt", "dateApplied", "id", "jobDescription", "jobTitle", "postingUrl", "salaryMax", "salaryMin", "statusId", "updatedAt", "userId" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
