# Retained inventory history in the available fridge list

During the real registered-owner customer staging browser check at source
01c372b4e7a818435712abdcbcc541602884b9db, a synthetic ingredient was created
at quantity 2 and incremented to 3. Reload preserved the update. Confirmed removal
committed the expected zero-quantity history row, but the fridge still displayed
that row and counted it as available stock after reload.

The inventory API intentionally retains zero-quantity rows so audit/history
references remain valid. InventoryPage used every returned row for cards and
counts. Filter only its available-stock view to positive quantities. Keep the
API, authority, cache, historical detail pages, data and tenancy unchanged.

Two focused UI regressions reproduce the problem on the baseline: an initial
read containing a tombstone and a refreshed query changing live stock into a
tombstone. Both fail before the change. After the view filter, all four relevant
UI suites pass: 54/54 tests. Lint, typecheck, production build and customer/Admin
migration smoke pass. Hosted checks and a real deployment browser recheck remain
separate evidence; this local fix does not certify Admin ST01-ST20.

Production Admin remains NOT_DEPLOYED. The new main SHA must obtain its own
checks and exact-source Admin staging acceptance before the protected production
sequence. No payment, authentication, schema or infrastructure change is included.
