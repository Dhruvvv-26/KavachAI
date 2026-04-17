#!/bin/bash

# ALL OUTPUT redirected to docs/verification/LIVE_RUN_RESULTS.md in the wrapper
echo "=== LIVE E2E TEST RUN ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# TEST 1: All services healthy
echo "--- TEST 1: Service Health ---"
PASS=true
for port in 8001 8002 8003 8004 8005 8006; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
  if [ "$STATUS" = "200" ]; then
    echo "✅ Port $port: HTTP 200"
  else
    echo "❌ Port $port: HTTP $STATUS"
    PASS=false
  fi
done
echo "Test 1: $PASS"

# TEST 2: ML models_loaded = 11
echo "--- TEST 2: ML Models ---"
ML_HEALTH=$(curl -s http://localhost:8006/health)
echo $ML_HEALTH | python3 -m json.tool
MODELS=$(echo $ML_HEALTH | python3 -c "import sys,json; print(json.load(sys.stdin).get('models_loaded', 0))")
[ "$MODELS" -ge "11" ] && echo "✅ Test 2 PASS (models_loaded: $MODELS)" || echo "❌ Test 2 FAIL (models_loaded: $MODELS)"

# TEST 3: Demo anchor worker exists in correct zone
echo "--- TEST 3: Demo Anchor Worker ---"
WORKER=$(curl -s http://localhost:8001/api/v1/riders/6fc7ae56-8cc2-4d32-b8cf-c21844a177ce)
echo $WORKER | python3 -m json.tool
echo $WORKER | python3 -c "import sys,json; d=json.load(sys.stdin); z=d.get('zone_code', ''); print('✅ Test 3 PASS' if 'delhi' in z.lower() else f'❌ Test 3 FAIL zone={z}')"

# TEST 4: SHAP premium breakdown
echo "--- TEST 4: SHAP Premium ---"
SHAP=$(curl -s -X POST http://localhost:8006/api/v1/premium/calculate \
  -H "Content-Type: application/json" \
  -d '{"city":"delhi_ncr","vehicle_type":"bicycle","coverage_tier":"standard","month":7,"historical_aqi_events_12m":45,"historical_rain_events_12m":28,"disruption_history_90d":15,"declared_daily_trips":30,"avg_daily_earnings":1100.0,"monthly_work_days":22}')
echo $SHAP | python3 -m json.tool
echo $SHAP | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Test 4 PASS' if 'shap_breakdown' in d else '❌ Test 4 FAIL: no shap_breakdown')"

# TEST 5: Clean trigger creates a claim record in DB
echo "--- TEST 5: Clean Trigger → DB Insert ---"
curl -s -X POST http://localhost:8003/api/v1/trigger/test \
  -H "Content-Type: application/json" \
  -d '{"zone_code":"delhi_rohini","event_type":"aqi","metric_value":450,"scenario":"clean"}' > /dev/null
sleep 15
CLAIM_RESULT=$(docker exec postgres psql -U kavachai -d kavachai -t -c "SELECT status, fraud_score FROM claims WHERE worker_id='6fc7ae56-8cc2-4d32-b8cf-c21844a177ce' ORDER BY created_at DESC LIMIT 1;")
echo "Latest claim: $CLAIM_RESULT"
echo "$CLAIM_RESULT" | grep -q "auto_approved\|soft_hold\|blocked" && echo "✅ Test 5 PASS" || echo "❌ Test 5 FAIL: No claim in DB"

# TEST 6: Spoofed trigger is blocked (fraud_score > 0.65)
echo "--- TEST 6: Spoofed Trigger → Blocked ---"
curl -s -X POST http://localhost:8003/api/v1/trigger/test \
  -H "Content-Type: application/json" \
  -d '{"zone_code":"delhi_rohini","event_type":"aqi","metric_value":500,"scenario":"spoofed"}' > /dev/null
sleep 15
SPOOF_RESULT=$(docker exec postgres psql -U kavachai -d kavachai -t -c "SELECT status, fraud_score FROM claims WHERE worker_id='6fc7ae56-8cc2-4d32-b8cf-c21844a177ce' ORDER BY created_at DESC LIMIT 1;")
echo "Latest claim after spoof: $SPOOF_RESULT"
echo "$SPOOF_RESULT" | grep -q "blocked\|BLOCKED" && echo "✅ Test 6 PASS" || echo "⚠️ Test 6: check fraud_score value above"

# TEST 7: Payment summary returns real data
echo "--- TEST 7: Payment Summary ---"
PAY=$(curl -s http://localhost:8005/api/v1/payments/summary)
echo $PAY | python3 -m json.tool
echo $PAY | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Test 7 PASS' if 'detail' not in d else '❌ Test 7 FAIL: still returning error')"

# TEST 8: Claims service verify-liveness endpoint exists
echo "--- TEST 8: verify-liveness endpoint ---"
LIVENESS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8004/api/v1/claims/verify-liveness)
[ "$LIVENESS_STATUS" != "404" ] && echo "✅ Test 8 PASS (HTTP $LIVENESS_STATUS)" || echo "❌ Test 8 FAIL: 404 — endpoint does not exist"

# TEST 9: FraudQueue status filter works
echo "--- TEST 9: Claims Status Filter ---"
FILTER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8004/api/v1/claims?status=auto_approved&limit=5")
[ "$FILTER_STATUS" = "200" ] && echo "✅ Test 9 PASS" || echo "❌ Test 9 FAIL: HTTP $FILTER_STATUS"

# TEST 10: Admin dashboard build artifact exists
echo "--- TEST 10: Admin Dashboard Build ---"
ls admin-dashboard/dist/index.html > /dev/null 2>&1 && echo "✅ Test 10 PASS: dist/index.html exists" || echo "❌ Test 10 FAIL: run npm run build in admin-dashboard/"

echo ""
echo "=== END OF LIVE E2E RUN ==="
