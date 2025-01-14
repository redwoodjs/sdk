-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InvoiceItem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InvoiceTaxItem";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL DEFAULT 'invoice',
    "userId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "supplierName" TEXT NOT NULL,
    "supplierContact" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "notesA" TEXT,
    "notesB" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "taxes" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("customer", "date", "id", "notesA", "notesB", "number", "status", "supplierContact", "supplierName", "title", "userId") SELECT "customer", "date", "id", "notesA", "notesB", "number", "status", "supplierContact", "supplierName", "title", "userId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
