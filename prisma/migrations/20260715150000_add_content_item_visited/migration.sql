-- AlterTable
ALTER TABLE "crush_date_content_items"
ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "visited_at" TIMESTAMP(3);
