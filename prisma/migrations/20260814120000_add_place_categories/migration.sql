-- Phase 1: expand the category contract while the previous application version
-- may still write `other` for places during the deployment handoff.
ALTER TABLE "crush_date_content_items"
DROP CONSTRAINT "crush_date_content_items_category_id_check",
DROP CONSTRAINT "crush_date_content_items_place_category_check";

-- `other` has an exact, non-inferred mapping to the new place category `7`.
-- No other content field is changed.
UPDATE "crush_date_content_items"
SET "category_id" = '7'
WHERE "content_type" = 'place'
  AND "category_id" = 'other';

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
    '7'
)),
ADD CONSTRAINT "crush_date_content_items_type_category_check"
CHECK (
    (
        "content_type" = 'food'
        AND "category_id" IN (
            'chinese',
            'hotpot',
            'barbecue',
            'asian',
            'western',
            'snack_fastfood',
            'dessert_drinks',
            'other'
        )
    )
    OR
    (
        "content_type" = 'place'
        AND "category_id" IN ('2', '3', '4', '5', '6', '7', 'other')
    )
);
