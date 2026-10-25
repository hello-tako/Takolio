INSERT INTO week_swap_receipts(id,household_id,actor_id,plan_id,meal_id,client_key,fingerprint,created_at) VALUES ('wkd02-losing-receipt','cat01-d1-home','cat01-d1-owner','wkd02-plan','wkd02-meal','wkd02-key-B','recipe-A','2030-01-02');
DELETE FROM meal_plan_slots_v2 WHERE id='wkd02-meal';
INSERT INTO week_swap_receipts(id,household_id,actor_id,plan_id,meal_id,client_key,fingerprint,created_at) VALUES ('wkd02-receipt','cat01-d1-home','cat01-d1-owner','wkd02-plan','wkd02-meal','wkd02-key-A','recipe-A','2030-01-02');
