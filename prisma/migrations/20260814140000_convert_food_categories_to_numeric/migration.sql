-- Phase 1: convert existing food categories to stable numeric strings while
-- keeping legacy values valid during the old/new application handoff.
ALTER TABLE "crush_date_content_items"
DROP CONSTRAINT "crush_date_content_items_category_id_check",
DROP CONSTRAINT "crush_date_content_items_type_category_check";

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

ALTER TABLE "crush_date_content_items"
ADD CONSTRAINT "crush_date_content_items_category_id_check"
CHECK ("category_id" IN (
    'chinese',
    'hotpot',
    'barbecue',
    'asian',
    'western',
    'snack_fastfood',
    'dessert_drinks',
    'other',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
)),
ADD CONSTRAINT "crush_date_content_items_type_category_check"
CHECK (
    (
        "content_type" = 'food'
        AND "category_id" IN (
            '2', '3', '4', '5', '6', '7', '8', '9',
            'chinese', 'hotpot', 'barbecue', 'asian', 'western',
            'snack_fastfood', 'dessert_drinks', 'other'
        )
    )
    OR
    (
        "content_type" = 'place'
        AND "category_id" IN ('2', '3', '4', '5', '6', '7', 'other')
    )
);
