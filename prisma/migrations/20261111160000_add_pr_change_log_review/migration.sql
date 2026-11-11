-- Keep historical AI columns for compatibility; no background worker uses them.
ALTER TABLE "pr_change_logs" ADD COLUMN "review" JSONB;
