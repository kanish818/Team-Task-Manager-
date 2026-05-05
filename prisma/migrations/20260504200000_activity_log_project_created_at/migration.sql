-- DropIndex
DROP INDEX IF EXISTS "ActivityLog_projectId_idx";

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");
