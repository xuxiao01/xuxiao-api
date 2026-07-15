-- CreateEnum
CREATE TYPE "CrushDatePlanStatus" AS ENUM ('active', 'backup', 'completed');

-- CreateEnum
CREATE TYPE "CrushDatePlanScenario" AS ENUM ('hot', 'cold', 'rainy', 'sunny', 'free');

-- CreateEnum
CREATE TYPE "CrushDatePlanPeriod" AS ENUM ('morning', 'noon', 'afternoon', 'evening');

-- CreateTable
CREATE TABLE "crush_date_plans" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CrushDatePlanStatus" NOT NULL,
    "date" DATE,
    "scenario" "CrushDatePlanScenario" NOT NULL,
    "scenario_text" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "source_backup_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crush_date_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crush_date_plan_items" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "type" "CrushDateContentType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "period" "CrushDatePlanPeriod" NOT NULL,
    "note" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "crush_date_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crush_date_plans_status_created_at_idx"
ON "crush_date_plans"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "crush_date_plans_completed_at_idx"
ON "crush_date_plans"("completed_at" DESC);

-- CreateIndex
CREATE INDEX "crush_date_plans_source_backup_id_idx"
ON "crush_date_plans"("source_backup_id");

-- Only one active plan may exist at a time.
CREATE UNIQUE INDEX "crush_date_plans_single_active_idx"
ON "crush_date_plans"("status")
WHERE "status" = 'active';

-- CreateIndex
CREATE UNIQUE INDEX "crush_date_plan_items_plan_id_source_id_key"
ON "crush_date_plan_items"("plan_id", "source_id");

-- CreateIndex
CREATE INDEX "crush_date_plan_items_plan_id_period_sort_order_idx"
ON "crush_date_plan_items"("plan_id", "period", "sort_order");

-- AddForeignKey
ALTER TABLE "crush_date_plans"
ADD CONSTRAINT "crush_date_plans_source_backup_id_fkey"
FOREIGN KEY ("source_backup_id") REFERENCES "crush_date_plans"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crush_date_plan_items"
ADD CONSTRAINT "crush_date_plan_items_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "crush_date_plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
