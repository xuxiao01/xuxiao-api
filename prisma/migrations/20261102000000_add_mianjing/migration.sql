BEGIN;

-- CreateEnum
CREATE TYPE "MianjingCategory" AS ENUM ('八股', '手撕', '算法', '场景题');

-- CreateEnum
CREATE TYPE "MianjingPriority" AS ENUM ('高', '中', '低');

-- CreateEnum
CREATE TYPE "MianjingMastery" AS ENUM ('不会', '模糊', '基本掌握', '熟练');

-- CreateEnum
CREATE TYPE "MianjingRecruitmentType" AS ENUM ('日常', '暑期', '秋招');

-- CreateEnum
CREATE TYPE "MianjingRound" AS ENUM ('一面', '二面', '三面');

-- CreateEnum
CREATE TYPE "MianjingPalette" AS ENUM ('teal', 'orange', 'yellow', 'red', 'coral', 'blue', 'purple', 'gray', 'white', 'black');

-- CreateTable
CREATE TABLE "mianjing_questions" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "MianjingCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "priority" "MianjingPriority" NOT NULL DEFAULT '中',
    "mastery" "MianjingMastery" NOT NULL DEFAULT '模糊',
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "base_count" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mianjing_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mianjing_companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "palette" "MianjingPalette" NOT NULL DEFAULT 'purple',
    "sort_order" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mianjing_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mianjing_occurrences" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recruitment_type" "MianjingRecruitmentType",
    "round" "MianjingRound",

    CONSTRAINT "mianjing_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mianjing_questions_company_ids_idx" ON "mianjing_questions" USING GIN ("company_ids");

-- CreateIndex
CREATE INDEX "mianjing_questions_updated_at_id_idx" ON "mianjing_questions"("updated_at" DESC, "id");

-- CreateIndex
CREATE INDEX "mianjing_questions_category_mastery_organized_idx" ON "mianjing_questions"("category", "mastery", "organized");

-- CreateIndex
CREATE UNIQUE INDEX "mianjing_companies_name_key" ON "mianjing_companies"("name");

-- CreateIndex
CREATE INDEX "mianjing_companies_sort_order_id_idx" ON "mianjing_companies"("sort_order", "id");

-- CreateIndex
CREATE INDEX "mianjing_occurrences_question_id_created_at_id_idx" ON "mianjing_occurrences"("question_id", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "mianjing_occurrences_company_id_idx" ON "mianjing_occurrences"("company_id");

-- AddForeignKey
ALTER TABLE "mianjing_occurrences" ADD CONSTRAINT "mianjing_occurrences_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "mianjing_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mianjing_occurrences" ADD CONSTRAINT "mianjing_occurrences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "mianjing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Business limits are also enforced by request validation.
ALTER TABLE "mianjing_questions" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "mianjing_questions" ALTER COLUMN "company_ids" SET NOT NULL;
ALTER TABLE "mianjing_questions" ADD CONSTRAINT "mianjing_questions_base_count_check"
  CHECK ("base_count" >= 0 AND "base_count" <= 9007199254740991);
ALTER TABLE "mianjing_questions" ADD CONSTRAINT "mianjing_questions_title_check"
  CHECK (length(btrim("title")) > 0 AND length("title") <= 10000);
ALTER TABLE "mianjing_companies" ADD CONSTRAINT "mianjing_companies_name_check"
  CHECK (length(btrim("name")) > 0);
ALTER TABLE "mianjing_occurrences" ADD CONSTRAINT "mianjing_occurrences_content_check"
  CHECK (length("content") <= 200000);

ALTER TABLE "mianjing_occurrences" ADD CONSTRAINT "mianjing_occurrences_source_check"
  CHECK (("recruitment_type" IS NULL) = ("round" IS NULL));

COMMIT;
