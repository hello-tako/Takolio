INSERT INTO users(id) VALUES ('cat01-d1-owner');
INSERT INTO households(id,name,created_by) VALUES ('cat01-d1-home','CAT01 local D1','cat01-d1-owner');
INSERT INTO household_members(id,household_id,user_id,role) VALUES ('cat01-d1-member','cat01-d1-home','cat01-d1-owner','owner');
INSERT INTO storage_locations(id,household_id,type,name,sort_order,is_default,created_at,updated_at)
VALUES ('cat01-d1-pantry','cat01-d1-home','PANTRY','Pantry',0,1,'2026-10-24T10:00:00Z','2026-10-24T10:00:00Z');
INSERT INTO inventory_commands (id, household_id, actor_id, client_key, fingerprint, command_type, result_json, created_at)
      VALUES ('241aff0a-0336-46f2-bedf-3031cfebf4b4', 'cat01-d1-home', 'cat01-d1-owner', 'cat01-d1-create', '{"actorId":"cat01-d1-owner","command":{"displayCategory":"spice","estimatedExpiryAt":null,"expiryAt":null,"expiryKind":"UNKNOWN","ingredientId":null,"lotId":"cat01-d1-lot","openedAt":null,"purchasePrice":null,"purchasedAt":null,"quantity":0.25,"rawName":"Local spice","sourceId":null,"sourceType":"MANUAL","storageLocationId":"cat01-d1-pantry","type":"CREATE","unit":"pack"},"householdId":"cat01-d1-home","manualCreate":{"projectionAfter":{"added_date":"2026-10-24T10:00:00Z","category":"spice","created_at":"2026-10-24T10:00:00Z","data_source":"manual","expiry_date":null,"expiry_kind":"unknown","expiry_source":"unknown","freshness":"fresh","household_id":"cat01-d1-home","id":"cat01-d1-lot","ingredient_id":null,"name":"Local spice","opened_at":null,"quantity":0.25,"storage":"pantry","unit":"pack","updated_at":"2026-10-24T10:00:00Z","version":1},"requestFingerprint":"cat01-d1-original-intent"}}', 'CREATE', '{"commandId":"241aff0a-0336-46f2-bedf-3031cfebf4b4","commandType":"CREATE","lotId":"cat01-d1-lot","version":1,"effects":[{"before":null,"after":{"id":"cat01-d1-lot","householdId":"cat01-d1-home","ingredientId":null,"rawName":"Local spice","displayCategory":"spice","quantityMilli":250,"canonicalUnit":"pack","storageLocationId":"cat01-d1-pantry","state":"ACTIVE","purchasedAt":null,"openedAt":null,"expiryAt":null,"estimatedExpiryAt":null,"expiryKind":"UNKNOWN","sourceType":"MANUAL","sourceId":null,"version":1,"createdAt":"2026-10-24T10:00:00Z","updatedAt":"2026-10-24T10:00:00Z","purchasePrice":null,"legacyExpiryAt":null,"legacyExpiryKind":null,"legacyExpirySource":null,"legacyOpenedAt":null,"legacyVersion":1},"changed":true,"deltaMilli":250}]}', '2026-10-24T10:00:00Z');
INSERT INTO inventory_events
    (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
    SELECT 'e65fde1e-f049-49a9-b008-1ed12943698a', 'cat01-d1-home', NULL, 'T09_GUARD',
      0, 'piece'
    WHERE changes() <> 1;
UPDATE households SET inventory_version = inventory_version WHERE id = 'cat01-d1-home' AND inventory_version = 2 AND EXISTS (SELECT 1 FROM household_members m JOIN users u ON u.id = m.user_id
  WHERE m.household_id = households.id AND u.id = 'cat01-d1-owner');
INSERT INTO inventory_events
    (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
    SELECT 'c2886a09-eb97-444c-8b7d-cb78016325d6', 'cat01-d1-home', '', 'T09_GUARD',
      NULL, 'piece'
    WHERE changes() <> 1;
INSERT INTO inventory_items (ingredient_id, name, quantity, unit, category, storage,
    expiry_date, expiry_kind, expiry_source, opened_at, freshness, version, updated_at,
    id, household_id, created_at, added_date, data_source)
    VALUES (NULL, 'Local spice', 0.25, 'pack', 'spice', 'pantry', NULL, 'unknown', 'unknown', NULL, 'fresh', 1, '2026-10-24T10:00:00Z', 'cat01-d1-lot', 'cat01-d1-home', '2026-10-24T10:00:00Z', '2026-10-24T10:00:00Z', 'manual') RETURNING id, version;
INSERT INTO inventory_events
    (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
    SELECT '0d91f2e0-f9c6-4a19-bebd-2a5d2b0dcfea', 'cat01-d1-home', '', 'T09_GUARD',
      0, NULL
    WHERE changes() <> 1;
INSERT INTO inventory_lots (ingredient_id, raw_name, quantity_milli, canonical_unit,
    storage_location_id, state, purchased_at, opened_at, expiry_at, estimated_expiry_at, expiry_kind, version,
    updated_at, currency, amount_minor, minor_digits, legacy_version, display_category, id, household_id, source_type, source_id,
    created_at, legacy_item_id, legacy_expiry_at, legacy_expiry_kind, legacy_expiry_source, legacy_opened_at)
    VALUES (NULL, 'Local spice', 250, 'pack', 'cat01-d1-pantry', 'ACTIVE', NULL, NULL, NULL, NULL, 'UNKNOWN', 1, '2026-10-24T10:00:00Z', NULL, NULL, NULL, 1, 'spice', 'cat01-d1-lot', 'cat01-d1-home', 'MANUAL', NULL, '2026-10-24T10:00:00Z', 'cat01-d1-lot', NULL, NULL, NULL, NULL) RETURNING id, version;
INSERT INTO inventory_events
    (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
    SELECT 'a8029229-8e9d-45d3-9ade-51392f304f1d', 'cat01-d1-home', '', NULL,
      0, 'piece'
    WHERE changes() <> 1;
INSERT INTO inventory_events
      (id, household_id, inventory_item_id, event_type, quantity_delta, unit, reason, metadata, created_at, command_id)
      VALUES ('1cffc449-052c-444b-9a41-27dbae6945eb', 'cat01-d1-home', 'cat01-d1-lot', 'ADD', 0.25, 'pack', NULL, '{"schemaVersion":1,"householdId":"cat01-d1-home","actorId":"cat01-d1-owner","commandId":"241aff0a-0336-46f2-bedf-3031cfebf4b4","commandType":"CREATE","before":null,"after":{"id":"cat01-d1-lot","householdId":"cat01-d1-home","ingredientId":null,"rawName":"Local spice","displayCategory":"spice","quantityMilli":250,"canonicalUnit":"pack","storageLocationId":"cat01-d1-pantry","state":"ACTIVE","purchasedAt":null,"openedAt":null,"expiryAt":null,"estimatedExpiryAt":null,"expiryKind":"UNKNOWN","sourceType":"MANUAL","sourceId":null,"version":1,"createdAt":"2026-10-24T10:00:00Z","updatedAt":"2026-10-24T10:00:00Z","purchasePrice":null,"legacyExpiryAt":null,"legacyExpiryKind":null,"legacyExpirySource":null,"legacyOpenedAt":null,"legacyVersion":1},"deltaMilli":250,"source":{"type":"MANUAL","id":null},"timestamp":"2026-10-24T10:00:00Z","clientKey":"cat01-d1-create","fingerprint":"{\"actorId\":\"cat01-d1-owner\",\"command\":{\"displayCategory\":\"spice\",\"estimatedExpiryAt\":null,\"expiryAt\":null,\"expiryKind\":\"UNKNOWN\",\"ingredientId\":null,\"lotId\":\"cat01-d1-lot\",\"openedAt\":null,\"purchasePrice\":null,\"purchasedAt\":null,\"quantity\":0.25,\"rawName\":\"Local spice\",\"sourceId\":null,\"sourceType\":\"MANUAL\",\"storageLocationId\":\"cat01-d1-pantry\",\"type\":\"CREATE\",\"unit\":\"pack\"},\"householdId\":\"cat01-d1-home\",\"manualCreate\":{\"projectionAfter\":{\"added_date\":\"2026-10-24T10:00:00Z\",\"category\":\"spice\",\"created_at\":\"2026-10-24T10:00:00Z\",\"data_source\":\"manual\",\"expiry_date\":null,\"expiry_kind\":\"unknown\",\"expiry_source\":\"unknown\",\"freshness\":\"fresh\",\"household_id\":\"cat01-d1-home\",\"id\":\"cat01-d1-lot\",\"ingredient_id\":null,\"name\":\"Local spice\",\"opened_at\":null,\"quantity\":0.25,\"storage\":\"pantry\",\"unit\":\"pack\",\"updated_at\":\"2026-10-24T10:00:00Z\",\"version\":1},\"requestFingerprint\":\"cat01-d1-original-intent\"}}","allocation":[{"lotId":"cat01-d1-lot","deltaMilli":250,"canonicalUnit":"pack"}]}', '2026-10-24T10:00:00Z', '241aff0a-0336-46f2-bedf-3031cfebf4b4');
INSERT INTO inventory_events
    (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
    SELECT 'd533c58c-6041-463a-9cbc-f1dd71f32753', 'cat01-d1-home', NULL, 'T09_GUARD',
      0, 'piece'
    WHERE changes() <> 1;
INSERT INTO inventory_events
      (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
      SELECT 'a9b5219c-2d5b-4f48-82f0-78cfb591a927', 'cat01-d1-home', NULL, 'T09_PATCH_POSTSTATE', 0, 'piece' WHERE NOT EXISTS
        (SELECT 1 FROM inventory_items WHERE id IS 'cat01-d1-lot' AND household_id IS 'cat01-d1-home' AND ingredient_id IS NULL AND name IS 'Local spice' AND quantity IS 0.25 AND unit IS 'pack' AND storage IS 'pantry' AND expiry_date IS NULL AND opened_at IS NULL AND expiry_kind IS 'unknown' AND expiry_source IS 'unknown' AND version IS 1 AND category IS 'spice' AND data_source IS 'manual' AND freshness IS 'fresh' AND added_date IS '2026-10-24T10:00:00Z' AND created_at IS '2026-10-24T10:00:00Z' AND updated_at IS '2026-10-24T10:00:00Z');
SELECT id,display_category,quantity_milli FROM inventory_lots WHERE id='cat01-d1-lot';
SELECT id,category,quantity FROM inventory_items WHERE id='cat01-d1-lot';

INSERT INTO meal_plans(id,household_id,start_date,end_date,status) VALUES ('wkd02-plan','cat01-d1-home','2030-01-02','2030-01-08','READY');
INSERT INTO meal_plan_days(id,plan_id,day_of_week,date,day_type) VALUES ('wkd02-day','wkd02-plan',3,'2030-01-02','cooking');
INSERT INTO meal_plan_slots(id,day_id,plan_id,slot_type,status,recipe_id) VALUES ('wkd02-meal','wkd02-day','wkd02-plan','dinner','PLANNED','recipe-original');
INSERT INTO meal_plan_days_v2(id,plan_id,day_of_week,date,day_type) VALUES ('wkd02-day','wkd02-plan',3,'2030-01-02','cooking');
INSERT INTO meal_plan_slots_v2(id,day_id,plan_id,slot_type,status,recipe_id) VALUES ('wkd02-meal','wkd02-day','wkd02-plan','dinner','PLANNED','recipe-original');

