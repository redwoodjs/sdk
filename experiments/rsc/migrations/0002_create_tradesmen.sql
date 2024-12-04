-- CreateTable
CREATE TABLE "Tradesman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cellnumber" TEXT NOT NULL,
    "profession" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tradesman_cellnumber_key" ON "Tradesman"("cellnumber");
CREATE UNIQUE INDEX "Tradesman_email_key" ON "Tradesman"("email");