-- CreateTable
CREATE TABLE "pr_change_logs" (
    "id" UUID NOT NULL,
    "repository" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pr_created_at" TIMESTAMPTZ(3) NOT NULL,
    "head_sha" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL,
    "files_complete" BOOLEAN NOT NULL,
    "change_type" TEXT NOT NULL DEFAULT 'unknown',
    "change_summary" TEXT,
    "analysis_status" TEXT NOT NULL DEFAULT 'pending',
    "analysis_partial" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT NOT NULL,
    "source_run_number" BIGINT NOT NULL,
    "source_run_attempt" INTEGER NOT NULL,
    "analysis_attempts" INTEGER NOT NULL DEFAULT 0,
    "analysis_started_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pr_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_change_log_files" (
    "id" UUID NOT NULL,
    "pr_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "previous_path" TEXT,
    "status" TEXT NOT NULL,
    "additions" INTEGER,
    "deletions" INTEGER,
    "patch" TEXT,
    "patch_status" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "pr_change_log_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_change_logs_pr_created_at_id_idx" ON "pr_change_logs"("pr_created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pr_change_logs_repository_pr_number_key" ON "pr_change_logs"("repository", "pr_number");

-- CreateIndex
CREATE UNIQUE INDEX "pr_change_log_files_pr_id_path_key" ON "pr_change_log_files"("pr_id", "path");

-- AddForeignKey
ALTER TABLE "pr_change_log_files" ADD CONSTRAINT "pr_change_log_files_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "pr_change_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
