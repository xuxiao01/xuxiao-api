-- Expand the database whitelist to match the existing application city config.
-- Keep constraint replacement atomic and bound how long it can block requests.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "crush_date_content_items"
DROP CONSTRAINT "crush_date_content_items_city_code_check",
ADD CONSTRAINT "crush_date_content_items_city_code_check"
CHECK ("city_code" IN (
    'beijing',
    'tianjin',
    'harbin',
    'yinchuan',
    'zhongwei',
    'wuzhong'
));

COMMIT;
