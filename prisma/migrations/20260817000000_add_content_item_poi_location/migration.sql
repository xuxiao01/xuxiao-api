-- Location is optional for the whole content item, but a bound Tencent POI must
-- always be complete. Existing rows are preserved with all new columns NULL.
ALTER TABLE "crush_date_content_items"
ADD COLUMN "poi_provider" TEXT,
ADD COLUMN "poi_id" TEXT,
ADD COLUMN "poi_title" TEXT,
ADD COLUMN "poi_address" TEXT,
ADD COLUMN "poi_latitude" DECIMAL(9, 6),
ADD COLUMN "poi_longitude" DECIMAL(10, 6),
ADD COLUMN "poi_adcode" TEXT,
ADD CONSTRAINT "crush_date_content_items_poi_location_check"
CHECK (
    (
        "poi_provider" IS NULL
        AND "poi_id" IS NULL
        AND "poi_title" IS NULL
        AND "poi_address" IS NULL
        AND "poi_latitude" IS NULL
        AND "poi_longitude" IS NULL
        AND "poi_adcode" IS NULL
    )
    OR
    (
        "poi_provider" = 'tencent'
        AND "poi_id" IS NOT NULL
        AND "poi_title" IS NOT NULL
        AND "poi_address" IS NOT NULL
        AND "poi_latitude" BETWEEN -90 AND 90
        AND "poi_longitude" BETWEEN -180 AND 180
        AND "poi_adcode" IS NOT NULL
    )
);
