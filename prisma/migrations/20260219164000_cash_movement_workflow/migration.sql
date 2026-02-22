-- CreateEnum
CREATE TYPE "CashMovementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED');

-- Keep old values while migrating current records.
ALTER TYPE "CashMovementType" RENAME TO "CashMovementType_old";
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- Add new workflow and actor columns.
ALTER TABLE "CashMovement"
  ADD COLUMN "status" "CashMovementStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ARS',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "deliveredById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Align creator field naming with current contract.
ALTER TABLE "CashMovement" RENAME COLUMN "createdByUserId" TO "createdById";

-- Map old movement types to new enum values.
ALTER TABLE "CashMovement"
  ALTER COLUMN "type" TYPE "CashMovementType"
  USING (
    CASE
      WHEN "type"::text = 'INCOME' THEN 'IN'::"CashMovementType"
      WHEN "type"::text = 'EXPENSE' THEN 'OUT'::"CashMovementType"
      WHEN "type"::text = 'ADJUSTMENT' AND "amount" < 0 THEN 'OUT'::"CashMovementType"
      ELSE 'IN'::"CashMovementType"
    END
  );

-- Preserve free text in the new description field.
UPDATE "CashMovement"
SET "description" = CASE
  WHEN COALESCE(NULLIF(BTRIM("note"), ''), '') <> ''
    AND COALESCE(NULLIF(BTRIM("reference"), ''), '') <> ''
    THEN CONCAT(BTRIM("note"), ' | ref: ', BTRIM("reference"))
  WHEN COALESCE(NULLIF(BTRIM("note"), ''), '') <> ''
    THEN BTRIM("note")
  WHEN COALESCE(NULLIF(BTRIM("reference"), ''), '') <> ''
    THEN CONCAT('ref: ', BTRIM("reference"))
  ELSE NULL
END
WHERE "description" IS NULL;

-- Keep existing business chronology as createdAt when occurredAt was provided.
UPDATE "CashMovement"
SET "createdAt" = "occurredAt"
WHERE "occurredAt" IS NOT NULL;

-- Initialize updatedAt for existing rows.
UPDATE "CashMovement"
SET "updatedAt" = "createdAt";

-- Remove legacy fields no longer used by the API contract.
ALTER TABLE "CashMovement"
  DROP COLUMN "reference",
  DROP COLUMN "note",
  DROP COLUMN "occurredAt";

-- Refresh indexes for query patterns.
DROP INDEX IF EXISTS "CashMovement_organizationId_occurredAt_idx";
DROP INDEX IF EXISTS "CashMovement_organizationId_branchId_occurredAt_idx";
DROP INDEX IF EXISTS "CashMovement_createdByUserId_idx";

CREATE INDEX "CashMovement_organizationId_status_createdAt_idx"
  ON "CashMovement"("organizationId", "status", "createdAt");
CREATE INDEX "CashMovement_organizationId_branchId_createdAt_idx"
  ON "CashMovement"("organizationId", "branchId", "createdAt");
CREATE INDEX "CashMovement_organizationId_branchId_status_idx"
  ON "CashMovement"("organizationId", "branchId", "status");

-- Refresh foreign keys for renamed/new actor fields.
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_createdByUserId_fkey";
ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_deliveredById_fkey"
  FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE "CashMovementType_old";
