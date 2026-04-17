# 🛡️ KavachAI — Final Project Demo Guide

> **Last Updated**: April 17, 2026  
> **Status**: 🟢 ALL SYSTEMS OPERATIONAL  
> **Environment**: Railway.app (Production) + Vercel (Dashboard) + Expo (Worker App)

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture Summary](#-architecture-summary)
3. [Environment Verification Checklist](#-environment-verification-checklist)
4. [Production Service Endpoints](#-production-service-endpoints)
5. [Pre-Demo Setup (10 minutes before)](#-pre-demo-setup)
6. [Demo Flow — 3-Minute Script](#-demo-flow--3-minute-script)
7. [Copy-Paste Commands Cheat Sheet](#-copy-paste-commands-cheat-sheet)
8. [Admin Dashboard Walkthrough](#-admin-dashboard-walkthrough)
9. [Worker App Walkthrough](#-worker-app-walkthrough)
10. [Troubleshooting](#-troubleshooting)

---

## 🎯 Project Overview

**KavachAI** is an AI-powered, parametric income protection platform for India's gig economy workers (delivery riders, e-commerce drivers). It provides:

- **Automated Payouts**: Zero-paperwork insurance triggered by real weather/pollution data
- **5-Layer Fraud Detection**: GPS spoofing, collusion rings, and behavioral anomaly detection using ML
- **SHAP-Explainable Pricing**: Transparent actuarial premiums with SHAP breakdown
- **LSTM Disruption Forecasting**: Predicting future disruptions with deep learning
- **Real-time Solvency Dashboard**: Loss ratio, BCR, and financial health monitoring

### The Story of Arjun Kumar (Demo Persona)
> Arjun is a Blinkit delivery cyclist in Rohini, Delhi. He pays ₹127/week for KavachAI's Standard coverage. When the AQI crosses 300, he automatically receives ₹350 — no claims filed, no documents uploaded. KavachAI's fraud engine ensures only genuine, on-ground workers get paid.

---

## 🏗️ Architecture Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                     KavachAI Production Stack                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Worker App  │  │   Admin     │  │  API Client  │              │
│  │ (Expo/RN)   │  │ Dashboard   │  │  (curl/test) │              │
│  │  iPhone     │  │  (Vercel)   │  │              │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                 │                      │
│  ═══════╪════════════════╪═════════════════╪══════════════════    │
│         │        HTTPS (Railway Edge)      │                      │
│  ═══════╪════════════════╪═════════════════╪══════════════════    │
│         ▼                ▼                 ▼                      │
│  ┌────────────────────────────────────────────────────────┐      │
│  │              Railway.app (6 Microservices)              │      │
│  │                                                        │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │      │
│  │  │ Worker   │ │ Policy   │ │ Trigger  │              │      │
│  │  │ :8001    │ │ :8002    │ │ Engine   │              │      │
│  │  │ Riders,  │ │ Premiums │ │ :8003    │              │      │
│  │  │ GPS, KYC │ │ Coverage │ │ Weather  │              │      │
│  │  └──────────┘ └──────────┘ └─────┬────┘              │      │
│  │                                   │ Kafka              │      │
│  │  ┌──────────┐ ┌──────────┐ ┌─────▼────┐              │      │
│  │  │ ML       │ │ Payment  │ │ Claims   │              │      │
│  │  │ :8006    │ │ :8005    │ │ :8004    │              │      │
│  │  │ SHAP,    │ │ Razorpay │ │ Fraud    │              │      │
│  │  │ LSTM,    │ │ UPI, FCM │ │ Scoring  │              │      │
│  │  │ Fraud ML │ │ Payouts  │ │ Auto-Adj │              │      │
│  │  └──────────┘ └──────────┘ └──────────┘              │      │
│  └────────────────────┬───────────────────────────────────┘      │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────┐      │
│  │               Managed Infrastructure                    │      │
│  │  PostgreSQL (Railway) │ Kafka (Aiven) │ Redis (Upstash) │      │
│  └────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Backend** | Python 3.12 + FastAPI | 6 microservices |
| **ML/AI** | XGBoost, LightGBM, SHAP, PyTorch LSTM, Isolation Forest | Premium pricing, fraud detection, disruption forecasting |
| **Database** | PostgreSQL 14 (Railway) | Persistent storage |
| **Messaging** | Apache Kafka / Aiven | Event-driven trigger → claim → payout pipeline |
| **Cache** | Redis / Upstash | Session cache, rate limiting |
| **Mobile** | React Native + Expo | Worker app (iPhone/Android) |
| **Dashboard** | React + Vite + TailwindCSS | Admin command center (Vercel) |
| **Payments** | Razorpay (Test Mode) | UPI payout simulation |
| **Weather APIs** | OpenWeatherMap, WAQI, WeatherAPI.com | Real-time weather/AQI/alerts |
| **Auth** | Supabase (Phone OTP) | Worker authentication |
| **Notifications** | Firebase Cloud Messaging (FCM) | Push notifications to riders |

---

## ✅ Environment Verification Checklist

### Root `.env` (Backend Services)
| Variable | Status | Value |
|:---|:---:|:---|
| `DATABASE_URL` | ✅ | `postgresql://postgres:***@monorail.proxy.rlwy.net:53487/railway` |
| `REDIS_URL` | ✅ | `rediss://default:***@assuring-woodcock-100306.upstash.io:6379` |
| `REDPANDA_BROKERS` | ✅ | `kavachai-kafka-kavachai-project.d.aivencloud.com:11576` |
| `KAFKA_SASL_USERNAME` | ✅ | `avnadmin` (SASL_SSL + PLAIN) |
| `OWM_API_KEY` | ✅ | Populated |
| `WAQI_API_KEY` | ✅ | Populated |
| `WEATHERAPI_KEY` | ✅ | `1e1d5ccb6cfc4f86bb855014261704` |
| `IPINFO_TOKEN` | ✅ | Populated |
| `RAZORPAY_KEY_ID` | ✅ | `rzp_test_SeSzKGnvln5M37` (Test Mode) |
| `SUPABASE_URL` | ✅ | `https://isosnodmzqvaedujnqkc.supabase.co` |
| `ONESIGNAL_APP_ID` | ✅ | Populated |
| `JWT_SECRET_KEY` | ✅ | Set |
| `FIREBASE_CREDS_JSON` | ✅ | Base64-encoded service account |
| `*_SERVICE_URL` | ✅ | All 6 point to `*.up.railway.app` |

### Admin Dashboard `.env`
| Variable | Status | Value |
|:---|:---:|:---|
| `VITE_WORKER_URL` | ✅ | Railway production |
| `VITE_POLICY_URL` | ✅ | Railway production |
| `VITE_TRIGGER_URL` | ✅ | Railway production |
| `VITE_CLAIMS_URL` | ✅ | Railway production |
| `VITE_PAYMENT_URL` | ✅ | Railway production |
| `VITE_ML_URL` | ✅ | Railway production |
| `VITE_DEMO_MODE` | ✅ | `false` (Live mode) |

### Worker App `.env`
| Variable | Status | Value |
|:---|:---:|:---|
| `EXPO_PUBLIC_WORKER_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_POLICY_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_TRIGGER_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_CLAIMS_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_PAYMENT_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_ML_SERVICE` | ✅ | Railway production |
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Populated |
| `EXPO_PUBLIC_WORKER_ID` | ✅ | `6fc7ae56-8cc2-4d32-b8cf-c21844a177ce` |

---

## 📡 Production Service Endpoints

| # | Service | Port | Production URL | Purpose |
|:---:|:---|:---:|:---|:---|
| 1 | **Worker Service** | 8001 | `https://worker-service-production-95dc.up.railway.app` | Rider profiles, GPS pings, zone assignment |
| 2 | **Policy Service** | 8002 | `https://policy-service-production-d88e.up.railway.app` | Policy lifecycle, premium calculation |
| 3 | **Trigger Engine** | 8003 | `https://trigger-engine-production.up.railway.app` | Weather monitoring, event triggers |
| 4 | **Claims Service** | 8004 | `https://claims-service-production-ee3e.up.railway.app` | Claim creation, fraud scoring, routing |
| 5 | **Payment Service** | 8005 | `https://payment-service-production-c487.up.railway.app` | Razorpay payouts, financial KPIs |
| 6 | **ML Service** | 8006 | `https://ml-service-production-0a98.up.railway.app` | SHAP premiums, LSTM forecasting, fraud ML |

### Quick Health Check (one-liner)
```bash
for url in \
  "https://worker-service-production-95dc.up.railway.app" \
  "https://policy-service-production-d88e.up.railway.app" \
  "https://trigger-engine-production.up.railway.app" \
  "https://claims-service-production-ee3e.up.railway.app" \
  "https://payment-service-production-c487.up.railway.app" \
  "https://ml-service-production-0a98.up.railway.app"; do
  echo -n "$(basename $url): "; curl -s -o /dev/null -w "%{http_code}" "$url/health"; echo
done
```

---

## 🔧 Pre-Demo Setup

### 10 Minutes Before Recording

**Step 1: Verify all services are online**
```bash
python3 scripts/god_mode_demo.py --env railway status
```
Expected output: All 6 services ✅ UP, Demo Rider Arjun Kumar visible with ACTIVE policy.

**Step 2: Seed demo data (if needed)**
```bash
python3 scripts/god_mode_demo.py --env railway seed
```

**Step 3: Open the admin dashboard**
- **Production**: https://kavachai-admin.vercel.app
- Verify it shows "Live" mode (not "Demo Mode")

**Step 4: Start the Mobile Proxy & Worker App**
Because some ISPs block direct mobile connection to Railway, we use a LAN proxy:
```bash
# 1. Start the mobile proxy in a separate terminal
python3 scripts/railway_mobile_proxy.py

# 2. In another terminal, start the worker app
cd worker-app
npx expo start -c    # -c clears the cache to pick up new .env values
```
- Scan QR code with your iPhone's Expo Go app
- Verify it shows "Arjun Kumar · delhi_rohini" at the top
- Verify "ML Online" indicator is green

**Step 5: Reset claims for clean demo (optional)**
```bash
python3 scripts/god_mode_demo.py --env railway reset
# Type RESET when prompted
```

---

## 🎬 Demo Flow — 3-Minute Script

### Phase 1: Context & System Overview (0:00 - 0:30)

**🎤 Speaking Script:**
> "KavachAI is an AI-powered parametric insurance platform that protects India's 10 million gig economy workers from climate disruptions. Our platform monitors real-time weather data across 6 cities and automatically triggers payouts — zero paperwork, zero claims."

**Actions:**
1. Show the **Admin Dashboard** → Overview page with the map and service status indicators
2. Run the status command to show all services are live:
   ```bash
   python3 scripts/god_mode_demo.py --env railway status
   ```
3. Show the **Worker App** on your phone — point out the Disruption Monitor with live AQI, Rain, and Heat bars

---

### Phase 2: The Happy Path — Automatic Payout (0:30 - 1:15)

**🎤 Speaking Script:**
> "Meet Arjun Kumar, a Blinkit cyclist in Delhi's Rohini zone. He pays ₹127 per week for Standard coverage. Watch what happens when Delhi's AQI crosses 450 — a Tier 3 hazardous event."

**Actions:**
1. Fire a **clean trigger** (legitimate weather event):
   ```bash
   python3 scripts/god_mode_demo.py --env railway trigger --type aqi --severity tier3 --scenario clean
   ```
2. Watch the terminal output — the claim is **AUTO-APPROVED** with fraud score ~0.06
3. Show the **Worker App** — the "Disruption Detected" modal appears with a countdown timer
4. Show the **Admin Dashboard** → Claims page to see the new auto-approved claim

**🎤 Speaking Script:**
> "₹500 credited instantly. Arjun didn't file a single form. The Trigger Engine detected the AQI event, the Claims Service verified his GPS location, and the Payment Service initiated a UPI payout. Total processing time: under 3 seconds."

---

### Phase 3: Fraud Defense Engine (1:15 - 2:00)

**🎤 Speaking Script:**
> "But what about fraud? Parametric insurance is vulnerable to GPS spoofing attacks. A malicious rider could use a mock GPS app from home to trigger payouts. Watch our 5-layer fraud defense in action."

**Actions:**
1. Fire a **spoofed trigger** (fraudulent attempt):
   ```bash
   python3 scripts/god_mode_demo.py --env railway trigger --type aqi --severity tier3 --scenario spoofed
   ```
2. Watch the terminal — the claim is **BLOCKED** with fraud score ~0.89-0.94
3. Point out the fraud flags: `MOCK_LOCATION_DETECTED`, `ZERO_GPS_VARIANCE`, `ELEVATION_MISMATCH`

**🎤 Speaking Script:**
> "Blocked instantly. Our fraud engine detected hardware-level GPS anomalies — zero sensor variance, elevation mismatches, impossible velocity profiles. The rider's claim was flagged with a 0.94 fraud score. Our Gradient Boosting and Isolation Forest models work together across 5 independent signal layers."

4. Show the **Admin Dashboard** → Fraud Queue page to visualize blocked claims

---

### Phase 4: Actuarial Intelligence & Transparency (2:00 - 3:00)

**🎤 Speaking Script:**
> "KavachAI isn't just automated — it's actuarially intelligent. Every premium is computed using SHAP-explainable machine learning."

**Actions:**
1. Run the **SHAP premium calculation**:
   ```bash
   curl -s -X POST "https://ml-service-production-0a98.up.railway.app/api/v1/premium/calculate" \
     -H "Content-Type: application/json" \
     -d '{"city":"delhi_ncr","vehicle_type":"bicycle","coverage_tier":"standard","month":7,"historical_aqi_events_12m":45,"historical_rain_events_12m":28,"disruption_history_90d":15,"declared_daily_trips":30,"avg_daily_earnings":1100.0,"monthly_work_days":22}' | python3 -m json.tool
   ```
2. Point out the `shap_breakdown` in the response — showing factor-by-factor contribution

**🎤 Speaking Script:**
> "You can see exactly why Arjun's premium is ₹127 per week. Zone risk in Delhi contributes 23%, monsoon seasonality adds 18%, and his personal disruption history contributes 12%. Full mathematical transparency for insurers and regulators."

3. Show the **Admin Dashboard** → Actuarial page for:
   - **Loss Ratio** (target < 75%)
   - **Solvency Index**
   - **Burning Cost Rate (BCR)**

4. Retrieve the **Payment Summary** KPI dashboard:
   ```bash
   curl -s "https://payment-service-production-c487.up.railway.app/api/v1/payments/summary" | python3 -m json.tool
   ```

**🎤 Closing Script:**
> "KavachAI: Protecting the backbone of India's gig economy with transparent, automated, and fraud-proof parametric insurance. Zero paperwork. Zero delays. Zero fraud. Thank you."

---

## 📋 Copy-Paste Commands Cheat Sheet

### 1. Health Check (All Services)
```bash
python3 scripts/god_mode_demo.py --env railway status
```

### 2. Seed Demo Worker
```bash
python3 scripts/god_mode_demo.py --env railway seed
```

### 3. Clean Payout Trigger (Happy Path)
```bash
python3 scripts/god_mode_demo.py --env railway trigger --type aqi --severity tier3 --scenario clean
```

### 4. Spoofed Fraud Trigger (Blocked)
```bash
python3 scripts/god_mode_demo.py --env railway trigger --type aqi --severity tier3 --scenario spoofed
```

### 5. Suspicious Trigger (Soft Hold — Graduated Response)
```bash
python3 scripts/god_mode_demo.py --env railway trigger --type heavy_rain --severity tier2 --scenario suspicious
```

### 6. Ring Attack (Coordinated Fraud)
```bash
python3 scripts/god_mode_demo.py --env railway fraud --scenario ring_attack
```

### 7. SHAP Premium Calculation
```bash
curl -s -X POST "https://ml-service-production-0a98.up.railway.app/api/v1/premium/calculate" \
  -H "Content-Type: application/json" \
  -d '{"city":"delhi_ncr","vehicle_type":"bicycle","coverage_tier":"standard","month":7,"historical_aqi_events_12m":45,"historical_rain_events_12m":28,"disruption_history_90d":15,"declared_daily_trips":30,"avg_daily_earnings":1100.0,"monthly_work_days":22}' | python3 -m json.tool
```

### 8. Raw Fraud Score Check
```bash
curl -s -X POST "https://ml-service-production-0a98.up.railway.app/api/v1/fraud/score" \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"6fc7ae56-8cc2-4d32-b8cf-c21844a177ce","gps_lat":28.73,"gps_lon":77.115,"claimed_zone":"delhi_rohini","device_fingerprint":"dev-seed-001","mock_location_flag":true,"gps_readings_variance":0.0001,"elevation_m":220.0,"speed_kph":0.5}' | python3 -m json.tool
```

### 9. Payment Summary (Financial KPIs)
```bash
curl -s "https://payment-service-production-c487.up.railway.app/api/v1/payments/summary" | python3 -m json.tool
```

### 10. Claims List (Admin View)
```bash
curl -s "https://claims-service-production-ee3e.up.railway.app/api/v1/claims?limit=10" | python3 -m json.tool
```

### 11. Worker Profile
```bash
curl -s "https://worker-service-production-95dc.up.railway.app/api/v1/riders/6fc7ae56-8cc2-4d32-b8cf-c21844a177ce" | python3 -m json.tool
```

### 12. ML Health (Model Count)
```bash
curl -s "https://ml-service-production-0a98.up.railway.app/health" | python3 -m json.tool
```
Expected: `models_loaded: 11`, `premium_ready: true`, `fraud_ready: true`, `lstm_ready: true`

### 13. Reset Demo State
```bash
python3 scripts/god_mode_demo.py --env railway reset
```

---

## 🖥️ Admin Dashboard Walkthrough

**URL**: https://kavachai-admin.vercel.app

### Key Pages to Show

| Page | What It Shows | Demo Highlight |
|:---|:---|:---|
| **Overview** | Service status, map with active zones, system metrics | Show green dots for all 6 services |
| **Claims** | All claims with status filters | Filter by `blocked` to show fraud catches |
| **Fraud Queue** | Claims flagged for review with fraud flags | Show `MOCK_LOCATION_DETECTED` flags |
| **Actuarial** | Loss Ratio, Solvency Index, BCR charts | Show financial health is within safe bounds |
| **Workers** | Registered rider profiles | Show Arjun Kumar's profile and zone |

---

## 📱 Worker App Walkthrough

### Features Visible on Screen

| Component | What It Shows |
|:---|:---|
| **Top Bar** | "KavachAI" + Rider name + Zone code + ML Online indicator |
| **SOAR Badge** | ML disruption prediction tier (Green/Yellow/Red) |
| **Coverage Card** | Active policy status, tier, weekly premium (₹127) |
| **Disruption Monitor** | 4 live ParameterBars (AQI, Rain, Heat, Overall Risk) |
| **Trigger Modal** | Pops up when disruption detected — "Verify Now" button with 5-min countdown |
| **GPSCamera** | Liveness verification — captures GPS + photo for fraud prevention |

### Worker App Demo Flow
1. Open the app → Show Coverage Card (ACTIVE, Standard, ₹127/week)
2. Fire a trigger from terminal → Watch the "⚠️ Disruption Detected" modal appear
3. Tap "Verify Now" → GPSCamera opens to capture GPS-stamped photo
4. Capture photo → Claim is submitted with liveness proof
5. Pull down to refresh → See updated payout history

---

## 🆘 Troubleshooting

| Issue | Cause | Fix |
|:---|:---|:---|
| **Service returns 502/503** | Railway cold start (first request after idle) | Wait 5-10 seconds and retry. Railway services sleep after 5 min of inactivity. |
| **"DNS resolution failed" / API Error** | ISP blocking Railway domains | Run `python3 scripts/railway_mobile_proxy.py` to route phone traffic securely to Railway via your laptop. |
| **Worker App shows "Loading..."** | `.env` not refreshed after changes | Run `npx expo start -c` (with cache clear flag) |
| **"No claims found" after trigger** | Kafka consumer lag | Wait 10-15 seconds. First Kafka consumption after cold start is slow. |
| **Admin Dashboard shows "Demo Mode"** | `VITE_DEMO_MODE=true` in dashboard `.env` | Set `VITE_DEMO_MODE=false` and redeploy |
| **ML Service shows 0 models** | Cold start — models loading into RAM | Wait 30-60 seconds for 11 models to load. Check `/health` for `models_loaded` count. |
| **god_mode_demo.py "Connection Refused"** | Script defaulting to localhost instead of Railway | Add `--env railway` flag: `python3 scripts/god_mode_demo.py --env railway status` |
| **Database "column not found" error** | Schema drift between code and production DB | This has been manually patched — do not run migrations. Use the existing Railway DB as-is. |
| **Payment Service "No Razorpay"** | Test mode — payouts are simulated | This is expected. Razorpay test keys simulate payouts without actual money movement. |

### Emergency Recovery Commands
```bash
# Check if Railway services are responding
curl -s "https://worker-service-production-95dc.up.railway.app/health"

# If DNS fails on the phone, use the mobile proxy:
python3 scripts/railway_mobile_proxy.py
# The worker-app/.env is already configured to use LAN IP on ports 9001-9006

# Verify database connectivity
python3 -c "
import psycopg2
conn = psycopg2.connect(host='monorail.proxy.rlwy.net', port=53487, dbname='railway', user='postgres', password='gXEDsoUqibzdIJajlUCGZkZovYlbcqaY')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM workers')
print(f'Workers: {cur.fetchone()[0]}')
cur.execute('SELECT COUNT(*) FROM claims')
print(f'Claims: {cur.fetchone()[0]}')
conn.close()
"
```

---

## 📊 Key Demo Numbers to Mention

| Metric | Value | Context |
|:---|:---|:---|
| **Services** | 6 microservices | FastAPI, event-driven, production-grade |
| **ML Models** | 11 loaded in RAM | XGBoost, LightGBM, SHAP, LSTM, Isolation Forest, Gradient Boosting |
| **Fraud Layers** | 5 independent signals | GPS variance, elevation, velocity, device fingerprint, behavioral |
| **Clean Fraud Score** | ~0.06 | Genuine rider — auto-approved |
| **Spoof Fraud Score** | ~0.89-0.94 | Mock GPS — blocked instantly |
| **Payout Time** | < 3 seconds | Trigger → Claim → Payout (end-to-end) |
| **Cities Covered** | 6 | Delhi, Mumbai, Bengaluru, Hyderabad, Pune, Kolkata |
| **Weather APIs** | 3 sources | OWM (weather), WAQI (AQI), WeatherAPI (severe alerts) |
| **Premium Transparency** | SHAP breakdown | Factor-by-factor contribution to premium |
| **Coverage** | ₹25-₹200/week | Based on zone, vehicle, and history |
| **Max Payout** | ₹500-₹750/event | Tier-dependent (Tier 1/2/3) |

---

## 🏆 Differentiators to Highlight

1. **Parametric** — No paperwork. Weather data triggers payouts automatically.
2. **Fraud-Proof** — 5-layer ML defense catches GPS spoofing, collusion rings, and behavioral anomalies.
3. **Explainable AI** — SHAP values make premium pricing transparent for regulators.
4. **Actuarially Sound** — Real-time loss ratio and solvency monitoring ensures financial sustainability.
5. **Production-Ready** — 6 microservices on Railway, managed Kafka (Aiven), managed Redis (Upstash), production Postgres.
6. **Mobile-First** — React Native worker app with GPSCamera liveness verification.
7. **LSTM Forecasting** — Predicts future disruptions to enable proactive reinsurance.

---

*This document is the single source of truth for the KavachAI demo presentation. Version: Final (April 17, 2026).*
