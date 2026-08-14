-- Phase 2 manual contraction for both food and place categories.
-- Run only after the numeric-category application is stable, its rollback
-- window is closed, and a fresh backup is verified.
BEGIN;

LOCK TABLE "crush_date_content_items" IN SHARE ROW EXCLUSIVE MODE;

UPDATE "crush_date_content_items"
SET "category_id" = CASE "category_id"
    WHEN 'chinese' THEN '2'
    WHEN 'hotpot' THEN '3'
    WHEN 'barbecue' THEN '4'
    WHEN 'asian' THEN '5'
    WHEN 'western' THEN '6'
    WHEN 'snack_fastfood' THEN '7'
    WHEN 'dessert_drinks' THEN '8'
    WHEN 'other' THEN '9'
    ELSE "category_id"
END
WHERE "content_type" = 'food';

UPDATE "crush_date_content_items"
SET "category_id" = '7'
WHERE "content_type" = 'place'
  AND "category_id" = 'other';

ALTER TABLE "crush_date_content_items"
ALTER COLUMN "category_id" DROP DEFAULT,
DROP CONSTRAINT "crush_date_content_items_category_id_check",
DROP CONSTRAINT "crush_date_content_items_type_category_check",
ADD CONSTRAINT "crush_date_content_items_category_id_check"
CHECK ("category_id" IN ('2', '3', '4', '5', '6', '7', '8', '9')),
ADD CONSTRAINT "crush_date_content_items_type_category_check"
CHECK (
    (
        "content_type" = 'food'
        AND "category_id" IN ('2', '3', '4', '5', '6', '7', '8', '9')
    )
    OR
    (
        "content_type" = 'place'
        AND "category_id" IN ('2', '3', '4', '5', '6', '7')
    )
);

COMMIT;
