-- CreateEnum
CREATE TYPE "CrushDateContentType" AS ENUM ('food', 'place');

-- CreateTable
CREATE TABLE "crush_date_content_items" (
    "id" TEXT NOT NULL,
    "content_type" "CrushDateContentType" NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crush_date_content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crush_date_content_items_content_type_created_at_idx"
ON "crush_date_content_items"("content_type", "created_at" DESC);
