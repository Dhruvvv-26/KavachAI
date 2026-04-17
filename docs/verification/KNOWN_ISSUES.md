# KavachAI — Known Issues & Limitations

> **Generated**: Phase 3 SOAR Completion
> **Last Updated**: 2026-04-15

---

## Active Issues

### 1. Worker App — Cannot Runtime Test Without Physical Device
- **Severity**: Low (development only)
- **Detail**: React Native + Expo sensor APIs (accelerometer, GPS, camera) cannot be tested in a browser or emulator. TypeScript compilation is verified, but runtime behavior requires a physical Android/iOS device.
- **Mitigation**: All types match backend schemas. API paths verified against actual backend router prefixes.



### 2. Background Location (iOS)
- **Severity**: Low
- **Detail**: iOS requires additional configuration for background location tasks beyond the info.plist entries. A `UIBackgroundModes` entry for `location` may be needed in production.
- **Mitigation**: The permission manager gracefully handles denied background permissions. A soft banner prompts users.

---

## Resolved Issues (This Session)

| Issue | Resolution |
|-------|-----------|
| Worker API used `/api/v1/workers/` | Changed to `/api/v1/riders/` matching backend |
| Admin FraudQueue used mock data | Wired to `fetchClaims` with SOFT_HOLD filter |
| Vite proxy paths didn't match backend | Updated to actual `/api/v1/*` prefixes |
| app.json missing 4 Android permissions | Added all 6 required permissions |
| app.json missing iOS plist keys | Added all 4 required keys |
| sensorCapture missing RMS/mock/heading | Complete rewrite with 7-layer payload |
| GPSCamera used base64 only | Added multipart FormData path |
| Policy screen hardcoded SHAP | Now calls ML service dynamically |
| ActuarialDashboard missing time-series | Added Recharts BarChart |
| Live E2E Tests — Require Docker Stack | Live backend tests passed via docker-compose |
| Claims Service `verify-liveness` Endpoint | Endpoint created and tested via dummy payload |
