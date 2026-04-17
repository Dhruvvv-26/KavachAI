# KavachAI — Worker App Integration Map

> **Generated**: Phase 3 SOAR Completion
> **Last Updated**: 2026-04-15

---

## File-to-Service Mapping

| Worker App File | Backend Service | Endpoint(s) |
|-----------------|----------------|-------------|
| `lib/api.ts` → `getWorkerProfile` | Worker (8001) | `GET /api/v1/riders/{id}` |
| `lib/api.ts` → `updateGPSPing` | Worker (8001) | `POST /api/v1/riders/{id}/gps-ping` |
| `lib/api.ts` → `getActivePolicy` | Policy (8002) | `GET /api/v1/policies/worker/{id}` |
| `lib/api.ts` → `calculatePremium` | ML (8006) | `POST /api/v1/premium/calculate` |
| `lib/api.ts` → `getPremiumBreakdown` | ML (8006) | `POST /api/v1/premium/calculate` |
| `lib/api.ts` → `getZoneWeather` | Trigger (8003) | `GET /api/v1/trigger/status` |
| `lib/api.ts` → `getWorkerClaims` | Claims (8004) | `GET /api/v1/claims/worker/{id}` |
| `lib/api.ts` → `sendSensorPing` | Claims (8004) | `POST /api/v1/claims/sensor_data/{id}` |
| `lib/api.ts` → `submitLivenessVerification` | Claims (8004) | `POST /api/v1/claims/verify-liveness` |
| `lib/api.ts` → `getWorkerPayments` | Payment (8005) | `GET /api/v1/payments/worker/{id}` |
| `lib/api.ts` → `getActiveDisruptions` | ML (8006) | `GET /api/v1/predict/disruptions/active` |

## Permission Flow

```
App Start → permissionManager.requestAllPermissions()
  ├── Location Foreground → expo-location
  ├── Location Background → expo-location (only if foreground granted)
  ├── Camera → expo-camera
  └── Motion (iOS only) → expo-sensors
  
Result cached in AsyncStorage as "kavachai_permissions_v1"
```

## Sensor Capture Pipeline

```
startSensorListeners()
  ├── Accelerometer at 10Hz → Rolling 100-sample RMS buffer
  ├── Gyroscope at 10Hz → Heading change tracking (5-min window)
  └── GPS Watcher → 5-ping circular buffer (BestForNavigation)

captureSensorPayload(workerId, zoneCode)
  → Returns complete SensorPayload with all 7 layers

startBackgroundPingJob(workerId, zoneCode)
  → GPS ping every 5 minutes
  → Stored in AsyncStorage (30-ping circular buffer)
  → POST'd to /api/v1/riders/{id}/gps-ping
```

## FCM Trigger Flow

```
Trigger Event Received (via polling or FCM)
  → Show TriggerEventModal with 5-minute countdown
  → User clicks "Verify Now"
  → GPSCamera launched (front-facing camera)
  → GPS + Photo captured
  → FormData POST to /api/v1/claims/verify-liveness
  → 200: onSuccess → refresh data
  → 403: onBlocked → show rejection reason
  → Error: show retry button
```

## Route Prefix Changes (Phase 3)

| Category | Old Path | New Path | Reason |
|----------|----------|----------|--------|
| Worker profile | `/api/v1/workers/{id}` | `/api/v1/riders/{id}` | Matches actual backend router prefix |
