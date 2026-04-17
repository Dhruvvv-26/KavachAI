# KavachAI — Failure Diagnosis & Resolution Log

> **Date**: 2026-04-16
> **Triggered By**: Full E2E run following README Section 9 instructions

---

## Failure 1: Claims Service — `column "gps_score" of relation "claims" does not exist`

### Symptom
```
sqlalchemy.exc.ProgrammingError: column "gps_score" of relation "claims" does not exist
[SQL: INSERT INTO claims (..., gps_score, sensor_score, network_score, behavioral_score, ...)]
```
Every spoofed and clean trigger test failed to persist a claim record.

### Root Cause
The Python ORM model (`services/claims_service/models/claim.py`, lines 125-128) defined 4 per-layer fraud score columns:
```python
gps_score        = Column(Numeric(5, 4))
sensor_score     = Column(Numeric(5, 4))
network_score    = Column(Numeric(5, 4))
behavioral_score = Column(Numeric(5, 4))
```

The database schema (`migrations/01_init.sql`) did NOT include these columns in the `CREATE TABLE claims` statement. A separate migration file (`migrations/009_add_claim_layer_scores.sql`) existed with the `ALTER TABLE` statements, but Docker only mounts `01_init.sql` and `02_zones.sql` into `docker-entrypoint-initdb.d`. Migration 009 was **never executed** against a running database.

### Fix Applied
1. **Immediate**: Ran the ALTER TABLE statements directly against the running postgres container:
   ```sql
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS gps_score NUMERIC(5,4);
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS sensor_score NUMERIC(5,4);
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS network_score NUMERIC(5,4);
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS behavioral_score NUMERIC(5,4);
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS selfie_url TEXT;
   ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewer_note TEXT;
   ```

2. **Permanent**: Added all 6 columns to the `CREATE TABLE claims` in `migrations/01_init.sql` so future fresh databases include them automatically.

### Verification
```
docker exec postgres psql -U kavachai -d kavachai -c "SELECT status, fraud_score FROM claims ORDER BY created_at DESC LIMIT 2;"
# Result: auto_approved (0.0598) and blocked (0.8865) — both inserted successfully
```

---

## Failure 2: Payment Service — `'Policy' has no attribute 'coverage_start'`

### Symptom
```
AttributeError: type object 'Policy' has no attribute 'coverage_start'
File "/app/routes/payments.py", line 141, in get_payment_summary
    Policy.coverage_start <= now,
```
`GET /api/v1/payments/summary` returned `{"detail": "Internal server error"}`.

### Root Cause
The payment service's read-only `Policy` model (`services/payment_service/models/payment.py`, line 95) only defined 5 columns:
```python
id, worker_id, zone_id, status, weekly_premium
```

But `routes/payments.py` line 141 accesses `Policy.coverage_start` and `Policy.coverage_end` for the trailing 30-day BCR (Burning Cost Rate) calculation. These columns exist in the database `policies` table (from `01_init.sql`) but were missing from the Python model.

### Fix Applied
Added 3 missing columns to the Payment service's `Policy` model:
```python
max_payout_per_event = Column(Numeric(8, 2))
coverage_start       = Column(DateTime(timezone=True))
coverage_end         = Column(DateTime(timezone=True))
```

Rebuilt the payment-service container: `docker compose up -d --build payment-service`

### Verification
```
curl -s http://localhost:8005/api/v1/payments/summary | python3 -m json.tool
# Result: Full JSON response with BCR, loss ratio, and all financial KPIs
```

---

## Failure 3 (Minor): Redis notification check in README

### Symptom
```bash
docker exec redis redis-cli -a redis_secure_2026 --raw LRANGE notifications:all 0 1
# Returns empty / invalid JSON parse error
```

### Root Cause
The `notifications:all` Redis list is never populated by any service. Redis is used only for idempotency locks (`lock:claim:*`, `lock:payment:*`). The README command was aspirational documentation.

### Fix Applied
Replaced the Redis check with a working database verification:
```bash
docker exec postgres psql -U kavachai -d kavachai -c "SELECT status, fraud_score, fraud_flags::text FROM claims ORDER BY created_at DESC LIMIT 1;"
```

---

## Why These Were Not Caught Earlier

The Phase 3 verification performed earlier was **static-only**:
- `grep` pattern matching against source files
- TypeScript/Vite build checks
- No Docker containers were started
- No database queries were executed
- No HTTP endpoints were hit

The failures were **runtime-only bugs** — model/schema mismatches that only surface during actual SQL execution inside running containers. Static analysis cannot detect these.

---

## Files Modified

| File | Change |
|------|--------|
| `migrations/01_init.sql` | Added 6 columns to `CREATE TABLE claims` |
| `services/payment_service/models/payment.py` | Added `coverage_start`, `coverage_end`, `max_payout_per_event` to Policy model |
| `README.md` | Replaced broken Redis check with working DB query |
| `WORKER_APP_DEMO.md` | Fixed `docker-compose.demo.yml` → `docker compose up -d` |

## Current Status: All 3 failures resolved ✅
