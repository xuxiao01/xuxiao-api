-- Add the new fields with safe compatibility defaults. Existing rows retain all
-- original values and receive Beijing / Other without category inference.
ALTER TABLE "crush_date_content_items"
ADD COLUMN "city_code" TEXT NOT NULL DEFAULT 'beijing',
ADD COLUMN "category_id" TEXT NOT NULL DEFAULT 'other';

-- Keep invalid codes out even when data is written outside the API.
ALTER TABLE "crush_date_content_items"
ADD CONSTRAINT "crush_date_content_items_city_code_check"
CHECK ("city_code" IN ('beijing', 'tianjin', 'harbin')),
ADD CONSTRAINT "crush_date_content_items_category_id_check"
CHECK ("category_id" IN (
    'chinese',
    'hotpot',
    'barbecue',
    'asian',
    'western',
    'snack_fastfood',
    'dessert_drinks',
    'other'
)),
ADD CONSTRAINT "crush_date_content_items_place_category_check"
CHECK ("content_type" <> 'place' OR "category_id" = 'other');

-- Supports the main city + tab query while preserving stable pagination order.
CREATE INDEX "crush_date_content_items_content_type_city_code_visited_cre_idx"
ON "crush_date_content_items"(
    "content_type",
    "city_code",
    "visited",
    "created_at" DESC,
    "id" DESC
);

-- Optimizes the visited tab's visitedAt ordering without indexing unvisited rows.
CREATE INDEX "crush_date_content_items_visited_visited_at_idx"
ON "crush_date_content_items"(
    "content_type",
    "city_code",
    "visited_at" DESC,
    "id" DESC
)
WHERE "visited" = true;
