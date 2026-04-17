=== LIVE E2E TEST RUN ===
Date: 2026-04-16T16:13:22Z

--- TEST 1: Service Health ---
✅ Port 8001: HTTP 200
✅ Port 8002: HTTP 200
✅ Port 8003: HTTP 200
✅ Port 8004: HTTP 200
✅ Port 8005: HTTP 200
✅ Port 8006: HTTP 200
Test 1: true
--- TEST 2: ML Models ---
{
    "status": "healthy",
    "service": "ml-service",
    "models_loaded": 11,
    "models_total": 14,
    "premium_ready": true,
    "fraud_ready": true,
    "lstm_ready": true
}
✅ Test 2 PASS (models_loaded: 11)
--- TEST 3: Demo Anchor Worker ---
{
    "worker_id": "6fc7ae56-8cc2-4d32-b8cf-c21844a177ce",
    "full_name": "Arjun Kumar",
    "platform": "blinkit",
    "vehicle_type": "bicycle",
    "work_hours_profile": "full_day",
    "declared_daily_trips": 30,
    "declared_daily_income": 1200.0,
    "zone_code": "delhi_rohini",
    "zone_name": "Rohini, Delhi",
    "city": "delhi_ncr",
    "kyc_status": "pending",
    "is_active": true,
    "created_at": "2026-04-15T09:11:27.360650Z"
}
✅ Test 3 PASS
--- TEST 4: SHAP Premium ---
{
    "weekly_premium": 88.96,
    "model_version": "xgb_lgb_v1",
    "shap_breakdown": {
        "base_rate": 25.0,
        "city_aqi_risk": 27.92,
        "seasonality": -0.05,
        "disruption_history_aqi": 7.41,
        "disruption_history_rain": -0.15,
        "coverage_tier": 0.34
    }
}
✅ Test 4 PASS
--- TEST 5: Clean Trigger → DB Insert ---
Latest claim:  auto_approved |      0.0542
✅ Test 5 PASS
--- TEST 6: Spoofed Trigger → Blocked ---
Latest claim after spoof:  blocked |      0.8857
✅ Test 6 PASS
--- TEST 7: Payment Summary ---
{
    "total_premiums_this_week": 127.0,
    "total_payouts_this_week": 0.0,
    "loss_ratio_percent": 0.0,
    "active_policies": 1,
    "claims_this_week": 13,
    "payments_completed": 0,
    "payments_pending": 0,
    "payments_failed": 0,
    "avg_payout_amount": 0.0,
    "daily_payout_volume": 0.0,
    "burning_cost_rate": 0.0,
    "bcr_status": "SOLVENT",
    "trailing_30d_premiums": 546.1,
    "trailing_30d_payouts": 0.0,
    "reserve_ratio": 100.0
}
✅ Test 7 PASS
--- TEST 8: verify-liveness endpoint ---
✅ Test 8 PASS (HTTP 422)
--- TEST 9: Claims Status Filter ---
✅ Test 9 PASS
--- TEST 10: Admin Dashboard Build ---
✅ Test 10 PASS: dist/index.html exists

=== END OF LIVE E2E RUN ===
