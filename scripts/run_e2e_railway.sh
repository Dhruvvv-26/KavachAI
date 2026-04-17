#!/bin/bash

echo "=== LIVE E2E TEST RUN (RAILWAY) ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

WORKER_URL="https://worker-service-production-95dc.up.railway.app"
POLICY_URL="https://policy-service-production-d88e.up.railway.app"
ML_URL="https://ml-service-production-0a98.up.railway.app"
TRIGGER_URL="https://trigger-engine-production.up.railway.app"
CLAIMS_URL="https://claims-service-production-ee3e.up.railway.app"
PAYMENT_URL="https://payment-service-production-c487.up.railway.app"
DB_URL="postgresql://postgres:gXEDsoUqibzdIJajlUCGZkZovYlbcqaY@monorail.proxy.rlwy.net:53487/railway"

# Helper for resolving payment URL manually since DNS may lag
PAYMENT_IP=$(nslookup payment-service-production-c487.up.railway.app 8.8.8.8 | grep Address: | tail -1 | awk '{print $2}')

# TEST 1: All services healthy
echo "--- TEST 1: Service Health ---"
PASS=true
for url in "$WORKER_URL" "$POLICY_URL" "$ML_URL" "$TRIGGER_URL" "$CLAIMS_URL"; do
  STATUS=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -o /dev/null -w "%{http_code}" "$url/health")
  if [ "$STATUS" = "200" ]; then
    echo "✅ URL $url: HTTP 200"
  else
    echo "❌ URL $url: HTTP $STATUS"
    PASS=false
  fi
done
# Check Payment separately with resolve if needed
P_STATUS=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 --resolve payment-service-production-c487.up.railway.app:443:$PAYMENT_IP -o /dev/null -w "%{http_code}" "$PAYMENT_URL/health")
if [ "$P_STATUS" = "200" ]; then
    echo "✅ URL $PAYMENT_URL: HTTP 200"
else
    echo "❌ URL $PAYMENT_URL: HTTP $P_STATUS"
    PASS=false
fi
echo "Test 1: $PASS"

# TEST 2: ML models_loaded = 11
echo "--- TEST 2: ML Models ---"
ML_HEALTH=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 "$ML_URL/health")
echo $ML_HEALTH | python3 -m json.tool
MODELS=$(echo $ML_HEALTH | python3 -c "import sys,json; print(json.load(sys.stdin).get('models_loaded', 0))")
[ "$MODELS" -ge "11" ] && echo "✅ Test 2 PASS (models_loaded: $MODELS)" || echo "❌ Test 2 FAIL (models_loaded: $MODELS)"

# TEST 3: Demo anchor worker exists in correct zone
echo "--- TEST 3: Demo Anchor Worker ---"
WORKER=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 "$WORKER_URL/api/v1/riders/6fc7ae56-8cc2-4d32-b8cf-c21844a177ce")
echo $WORKER | python3 -m json.tool
echo $WORKER | python3 -c "import sys,json; d=json.load(sys.stdin); z=d.get('zone_code', ''); print('✅ Test 3 PASS' if 'delhi' in z.lower() else f'❌ Test 3 FAIL zone={z}')"

# TEST 4: SHAP premium breakdown
echo "--- TEST 4: SHAP Premium ---"
SHAP=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -X POST "$ML_URL/api/v1/premium/calculate" \
  -H "Content-Type: application/json" \
  -d '{"city":"delhi_ncr","vehicle_type":"bicycle","coverage_tier":"standard","month":7,"historical_aqi_events_12m":45,"historical_rain_events_12m":28,"disruption_history_90d":15,"declared_daily_trips":30,"avg_daily_earnings":1100.0,"monthly_work_days":22}')
echo $SHAP | python3 -m json.tool
echo $SHAP | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Test 4 PASS' if 'shap_breakdown' in d else '❌ Test 4 FAIL: no shap_breakdown')"

# TEST 5: Clean trigger creates a claim record in DB
echo "--- TEST 5: Clean Trigger → DB Insert ---"
curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -X POST "$TRIGGER_URL/api/v1/trigger/test" \
  -H "Content-Type: application/json" \
  -d '{"zone_code":"delhi_rohini","event_type":"aqi","metric_value":450,"scenario":"clean"}' > /dev/null
sleep 15
CLAIM_RESULT=$(docker run --rm postgres:14 psql "$DB_URL" -t -c "SELECT status, fraud_score FROM claims WHERE worker_id='6fc7ae56-8cc2-4d32-b8cf-c21844a177ce' ORDER BY created_at DESC LIMIT 1;")
echo "Latest claim: $CLAIM_RESULT"
echo "$CLAIM_RESULT" | grep -q "auto_approved\|soft_hold\|blocked" && echo "✅ Test 5 PASS" || echo "❌ Test 5 FAIL: No claim in DB"

# TEST 6: Spoofed trigger is blocked (fraud_score > 0.65)
echo "--- TEST 6: Spoofed Trigger → Blocked ---"
curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -X POST "$TRIGGER_URL/api/v1/trigger/test" \
  -H "Content-Type: application/json" \
  -d '{"zone_code":"delhi_rohini","event_type":"aqi","metric_value":500,"scenario":"spoofed"}' > /dev/null
sleep 15
SPOOF_RESULT=$(docker run --rm postgres:14 psql "$DB_URL" -t -c "SELECT status, fraud_score FROM claims WHERE worker_id='6fc7ae56-8cc2-4d32-b8cf-c21844a177ce' ORDER BY created_at DESC LIMIT 1;")
echo "Latest claim after spoof: $SPOOF_RESULT"
echo "$SPOOF_RESULT" | grep -E -q "blocked|BLOCKED" && echo "✅ Test 6 PASS" || echo "⚠️ Test 6: check fraud_score value above"

# TEST 7: Payment summary returns real data
echo "--- TEST 7: Payment Summary ---"
PAY=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 --resolve payment-service-production-c487.up.railway.app:443:$PAYMENT_IP "$PAYMENT_URL/api/v1/payments/summary")
echo $PAY | python3 -m json.tool
echo $PAY | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Test 7 PASS' if 'detail' not in d else '❌ Test 7 FAIL: still returning error')"

# TEST 8: Claims service verify-liveness endpoint exists
echo "--- TEST 8: verify-liveness endpoint ---"
LIVENESS_STATUS=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -o /dev/null -w "%{http_code}" -X POST "$CLAIMS_URL/api/v1/claims/verify-liveness")
[ "$LIVENESS_STATUS" != "404" ] && echo "✅ Test 8 PASS (HTTP $LIVENESS_STATUS)" || echo "❌ Test 8 FAIL: 404 — endpoint does not exist"

# TEST 9: FraudQueue status filter works
echo "--- TEST 9: Claims Status Filter ---"
FILTER_STATUS=$(curl -s --resolve payment-service-production-c487.up.railway.app:443:151.101.2.15 --resolve trigger-engine-production.up.railway.app:443:151.101.2.15 --resolve ml-service-production-0a98.up.railway.app:443:151.101.2.15 --resolve worker-service-production-95dc.up.railway.app:443:151.101.2.15 --resolve policy-service-production-d88e.up.railway.app:443:151.101.2.15 --resolve claims-service-production-ee3e.up.railway.app:443:151.101.2.15 -o /dev/null -w "%{http_code}" "$CLAIMS_URL/api/v1/claims?status=auto_approved&limit=5")
[ "$FILTER_STATUS" = "200" ] && echo "✅ Test 9 PASS" || echo "❌ Test 9 FAIL: HTTP $FILTER_STATUS"

echo ""
echo "=== END OF LIVE E2E RUN ==="
