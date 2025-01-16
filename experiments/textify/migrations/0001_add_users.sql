-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cellnumber" TEXT NOT NULL,
    "language" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cellnumber_key" ON "User"("cellnumber");
