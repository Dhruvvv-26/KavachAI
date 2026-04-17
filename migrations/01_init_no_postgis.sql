-- ============================================================
-- KavachAI — Database Schema (No PostGIS)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE vehicle_type AS ENUM ('bicycle', 'e_bike', 'motorcycle', 'scooter');
CREATE TYPE platform_type AS ENUM ('blinkit', 'zepto', 'dunzo', 'swiggy_instamart');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'disputed', 'paid');
CREATE TYPE trigger_type AS ENUM ('aqi', 'rain', 'heat', 'curfew', 'strike');

CREATE TABLE zones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_code       VARCHAR(50) UNIQUE NOT NULL,
    zone_name       VARCHAR(100) NOT NULL,
    city            VARCHAR(50) NOT NULL,
    geohash         VARCHAR(12),
    boundary        TEXT NOT NULL,
    risk_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_zones_city ON zones(city);

CREATE TABLE workers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_hash              VARCHAR(128) UNIQUE NOT NULL,
    full_name               VARCHAR(255) NOT NULL,
    platform                VARCHAR(50) NOT NULL,
    zone_id                 UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    vehicle_type            vehicle_type NOT NULL,
    avg_daily_earnings      NUMERIC(10,2),
    declared_daily_trips    INTEGER,
    fcm_token               TEXT,
    is_verified             BOOLEAN DEFAULT FALSE,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workers_zone_id ON workers(zone_id);

CREATE TABLE gps_pings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    latitude        NUMERIC(10,8) NOT NULL,
    longitude       NUMERIC(11,8) NOT NULL,
    accuracy_meters NUMERIC(7,2),
    recorded_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gps_pings_worker_recorded ON gps_pings(worker_id, recorded_at DESC);

CREATE TABLE policies (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id               UUID NOT NULL UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
    zone_id                 UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    coverage_tier           VARCHAR(50) NOT NULL DEFAULT 'standard',
    premium_amount          NUMERIC(8,2) NOT NULL,
    currency                VARCHAR(3) DEFAULT 'INR',
    activation_date         TIMESTAMPTZ NOT NULL,
    expiration_date         TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'active',
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policies_worker_id ON policies(worker_id);

CREATE TABLE trigger_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id         UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    event_type      trigger_type NOT NULL,
    metric_value    NUMERIC(10,2) NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trigger_events_zone_triggered ON trigger_events(zone_id, triggered_at DESC);

CREATE TABLE claims (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    policy_id               UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    trigger_event_id        UUID REFERENCES trigger_events(id) ON DELETE SET NULL,
    zone_id                 UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    claim_amount            NUMERIC(10,2) NOT NULL,
    payout_amount           NUMERIC(10,2),
    status                  claim_status NOT NULL DEFAULT 'pending',
    fraud_score             NUMERIC(3,2) DEFAULT 0,
    fraud_flags             TEXT[] DEFAULT '{}',
    layer_scores            JSONB,
    worker_gps_at_claim     TEXT,
    claim_zone_verified     BOOLEAN,
    claimed_at              TIMESTAMPTZ NOT NULL,
    reviewed_at             TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_claims_worker_id ON claims(worker_id);
CREATE INDEX idx_claims_status ON claims(status);

CREATE TABLE payments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id                UUID NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
    worker_id               UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    amount                  NUMERIC(10,2) NOT NULL,
    currency                VARCHAR(3) DEFAULT 'INR',
    payment_gateway         VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    gateway_transaction_id  VARCHAR(255),
    gateway_status          VARCHAR(50),
    status                  VARCHAR(50) NOT NULL DEFAULT 'pending',
    processed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_claim_id ON payments(claim_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE TABLE payment_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    old_status      VARCHAR(50),
    new_status      VARCHAR(50),
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE premium_calculations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id         UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    city            VARCHAR(50) NOT NULL,
    vehicle_type    vehicle_type NOT NULL,
    coverage_tier   VARCHAR(50) NOT NULL,
    base_premium    NUMERIC(10,2) NOT NULL,
    adjusted_premium NUMERIC(10,2) NOT NULL,
    shap_breakdown  JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
