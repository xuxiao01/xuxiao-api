-- AlterTable
ALTER TABLE "User" ADD COLUMN     "public_weekly_reports_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "weekly_report_weeks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "week_key" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_report_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" SERIAL NOT NULL,
    "week_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "part_label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_report_items" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "images" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_report_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_report_weeks_user_id_start_date_idx" ON "weekly_report_weeks"("user_id", "start_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_report_weeks_user_id_week_key_key" ON "weekly_report_weeks"("user_id", "week_key");

-- CreateIndex
CREATE INDEX "weekly_reports_week_id_idx" ON "weekly_reports"("week_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_week_id_sort_order_key" ON "weekly_reports"("week_id", "sort_order");

-- CreateIndex
CREATE INDEX "weekly_report_items_report_id_idx" ON "weekly_report_items"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_report_items_report_id_section_sort_order_key" ON "weekly_report_items"("report_id", "section", "sort_order");

-- AddForeignKey
ALTER TABLE "weekly_report_weeks" ADD CONSTRAINT "weekly_report_weeks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weekly_report_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_report_items" ADD CONSTRAINT "weekly_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "weekly_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
