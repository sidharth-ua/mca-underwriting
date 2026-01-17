-- CreateEnum
CREATE TYPE "ParseQuality" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNASSIGNED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "parseQuality" "ParseQuality",
ADD COLUMN     "rawCategory" TEXT,
ADD COLUMN     "rawSubcategory" TEXT;

-- CreateIndex
CREATE INDEX "transactions_parseQuality_idx" ON "transactions"("parseQuality");
