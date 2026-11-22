-- Migration 0050: Global Phase 3 — Multi-Currency Billing (`dodo_mor` Merchant of Record + `payos_vn`),
-- Standard Webhooks Idempotency Ledger, Subscription Lifecycle (Grace Period, Portal & Cancel-at-Period-End),
-- and Federated OAuth Identities (Google, Sign in with Apple, LINE Login).
-- Additive & backward-compatible; standard rowid tables only.

-- 1. Multi-currency global payment intents (`amount_minor` + `minor_digits` + tax & EU Art. 16(m) waiver).
-- Existing `payment_intents` (`amount_vnd`) remains untouched for legacy PayOS VND routes.
CREATE TABLE global_payment_intents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('dodo_mor', 'payos_vn')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  currency TEXT NOT NULL CHECK (
    currency IN (
      'JPY', 'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ISK', 'USD', 'VND'
    )
  ),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  minor_digits INTEGER NOT NULL CHECK (minor_digits IN (0, 2)),
  tax_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(tax_amount_minor) = 'integer' AND tax_amount_minor >= 0),
  tax_inclusive INTEGER NOT NULL DEFAULT 1 CHECK (tax_inclusive IN (0, 1)),
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  payment_method_types_json TEXT NOT NULL DEFAULT '["credit","debit"]' CHECK (
    json_valid(payment_method_types_json) AND json_type(payment_method_types_json) = 'array'
  ),
  eu_withdrawal_waiver_at TEXT,
  idempotency_key TEXT,
  provider_session_id TEXT,
  provider_reference TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'awaiting_async_payment', 'paid', 'failed', 'expired', 'refunded')
  ),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_global_payment_intents_user_idem
  ON global_payment_intents(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX idx_global_payment_intents_provider_session
  ON global_payment_intents(provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE UNIQUE INDEX idx_global_payment_intents_provider_ref
  ON global_payment_intents(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX idx_global_payment_intents_user_status
  ON global_payment_intents(user_id, status);

-- 2. Idempotent webhook event deduplication ledger (Standard Webhooks `webhook-id`).
CREATE TABLE billing_webhook_events (
  provider TEXT NOT NULL CHECK (provider IN ('dodo_mor', 'payos_vn')),
  event_id TEXT NOT NULL CHECK (length(trim(event_id)) > 0),
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
  intent_id TEXT,
  processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, event_id)
);

-- 3. Federated OAuth identities (Google, Apple `privaterelay.appleid.com`, LINE Japan).
CREATE TABLE oauth_identities (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'line')),
  provider_subject TEXT NOT NULL CHECK (length(trim(provider_subject)) > 0),
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  is_private_relay INTEGER NOT NULL DEFAULT 0 CHECK (is_private_relay IN (0, 1)),
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX idx_oauth_identities_user
  ON oauth_identities(user_id);

-- 4. Additive recurring subscription lifecycle columns on `subscriptions`.
ALTER TABLE subscriptions ADD COLUMN provider TEXT CHECK (
  provider IS NULL OR provider IN ('dodo_mor', 'payos_vn')
);
ALTER TABLE subscriptions ADD COLUMN provider_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN dodo_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_currency TEXT;
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (
  cancel_at_period_end IN (0, 1)
);
ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at TEXT;
