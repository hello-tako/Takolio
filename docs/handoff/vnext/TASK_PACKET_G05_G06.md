# TASK_PACKET_G05_G06.md — Shell, Home, Fridge Inventory & AI Scan (`C01–C14`)

- **Gates:** `G05` (`C01–C08`) & `G06` (`C09–C14`)
- **Screen IDs in Scope (`14`):**
  - `C01`: `/` (`C01HomePilot` — server-first home, FEFO stock, estimated expiry labels, recommended dishes)
  - `C02`: `/search` + modal Command Sheet in `ConsumerStudioShell` (`C02QuickSearchPage` — zero fabricated hits)
  - `C03`: `/fridge` & `/inventory` (`C03InventoryPilot` — separate empty fridge vs empty filter)
  - `C04`: `/fridge?q=...&cat=...&freshness=...` (URL-synced search/category/freshness filter state)
  - `C05`: `/fridge?action=add` (Inline/sheet add ingredient form with `+3/+5/+7 ngày` `expiryEstimated=true` chips)
  - `C06 / C07`: `/fridge/:id`, `/inventory/:id`, `/ingredients/:id` (`C06LotDetailVNext` wrapping authoritative `IngredientDetailPage` with `DraftOwner`, `If-Match` version, `409` refetch truth)
  - `C08`: `/inventory-reconciliation` (`C08ReconciliationVNext` wrapping authoritative T13 `ReconciliationPage`)
  - `C09 / C10`: `/scan` (`C09ScanStudioVNext` — camera capture, permission denied / file upload fallback, private image cancel lifecycle)
  - `C11 / C12 / C13`: `/scan/:id/review` (`C12ScanReviewVNext` — queued/analyzing, mandatory human review draft, server-confirmed state)
  - `C14`: `/scan/receipt-review` (`C14ReceiptReviewVNext` — receipt OCR review with raw evidence & zero phantom prices)
- **Protected Red-Zone Impact:** `NONE` (`0` protected files modified).
