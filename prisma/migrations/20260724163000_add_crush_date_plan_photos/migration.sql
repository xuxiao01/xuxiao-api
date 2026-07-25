-- CreateTable
CREATE TABLE "crush_date_plan_photos" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crush_date_plan_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crush_date_plan_photos_object_key_key"
ON "crush_date_plan_photos"("object_key");

-- CreateIndex
CREATE INDEX "crush_date_plan_photos_plan_id_sort_order_created_at_idx"
ON "crush_date_plan_photos"("plan_id", "sort_order", "created_at");

-- AddForeignKey
ALTER TABLE "crush_date_plan_photos"
ADD CONSTRAINT "crush_date_plan_photos_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "crush_date_plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
