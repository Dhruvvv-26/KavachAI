# KavachAI — All Endpoints Reference

> **Generated**: Phase 3 SOAR Completion
> **Last Updated**: 2026-04-15

---

## Worker Service (Port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/riders/{worker_id}` | Get worker profile |
| `POST` | `/api/v1/riders/{worker_id}/gps-ping` | Submit GPS ping |
| `GET`  | `/api/v1/zones` | List all zones |
| `GET`  | `/api/v1/disruptions/active` | Get active disruptions |
| `GET`  | `/health` | Health check |

## Policy Service (Port 8002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/policies/worker/{worker_id}` | Get worker policies |
| `GET`  | `/api/v1/policies/exclusions/reference` | Force majeure exclusions |
| `POST` | `/api/v1/premium/calculate` | Calculate premium with SHAP |
| `GET`  | `/health` | Health check |

## Trigger Engine (Port 8003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/trigger/status` | Current trigger status |
| `GET`  | `/api/v1/trigger/history` | Trigger history (query: zone_code) |
| `GET`  | `/health` | Health check |

## Claims Service (Port 8004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/claims` | List claims (paginated, admin) |
| `GET`  | `/api/v1/claims/{claim_id}` | Get single claim |
| `GET`  | `/api/v1/claims/worker/{worker_id}` | Claims for a worker |
| `GET`  | `/api/v1/claims/zone/{zone_code}` | Claims in a zone |
| `POST` | `/api/v1/claims/sensor_data/{worker_id}` | Submit sensor data |
| `POST` | `/api/v1/claims/admin/review/{claim_id}` | Admin manual override |
| `POST` | `/api/v1/claims/admin/audit` | Log admin action |
| `GET`  | `/health` | Health check |

## Payment Service (Port 8005)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/payments/worker/{worker_id}` | Worker payment history |
| `GET`  | `/api/v1/payments/summary` | Financial summary (BCR) |
| `GET`  | `/health` | Health check |

## ML Service (Port 8006)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/premium/calculate` | SHAP premium calculation |
| `GET`  | `/api/v1/predict/disruption` | Zone disruption prediction |
| `GET`  | `/api/v1/predict/disruptions/active` | Active disruption predictions |
| `POST` | `/api/v1/fraud/score` | Fraud scoring |
| `GET`  | `/api/v1/clique/zones` | Zone clustering |
| `GET`  | `/health` | Health check |

---

## Notes

- All services have CORSMiddleware configured allowing `*` origins
- Worker app uses `EXPO_PUBLIC_*` env vars for service URLs
- Admin dashboard uses `VITE_*` env vars; falls back to `localhost:800X`
- All endpoints return JSON. Sensor data endpoint returns HTTP 202.
