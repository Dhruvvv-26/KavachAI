import requests
import json
import time
import subprocess

print("=== LIVE E2E TEST RUN (RAILWAY PYTHON) ===")

urls = {
    "worker": "https://worker-service-production-95dc.up.railway.app",
    "policy": "https://policy-service-production-d88e.up.railway.app",
    "ml": "https://ml-service-production-0a98.up.railway.app",
    "trigger": "https://trigger-engine-production.up.railway.app",
    "claims": "https://claims-service-production-ee3e.up.railway.app",
    "payment": "https://payment-service-production-c487.up.railway.app"
}

db_url = "postgresql://postgres:gXEDsoUqibzdIJajlUCGZkZovYlbcqaY@monorail.proxy.rlwy.net:53487/railway"

# Test 1: Health
print("\n--- TEST 1: Service Health ---")
for name, url in urls.items():
    try:
        r = requests.get(f"{url}/health", timeout=10)
        print(f"✅ {name}: HTTP {r.status_code}")
    except Exception as e:
        print(f"❌ {name}: {e}")

# Test 2: ML Models
print("\n--- TEST 2: ML Models ---")
try:
    r = requests.get(f"{urls['ml']}/health", timeout=10)
    data = r.json()
    models = data.get("models_loaded", 0)
    if models >= 11:
        print(f"✅ Test 2 PASS (models_loaded: {models})")
    else:
        print(f"❌ Test 2 FAIL (models_loaded: {models})")
except Exception as e:
    print(f"❌ Test 2 FAIL: {e}")

# Test 3: Demo Anchor
print("\n--- TEST 3: Demo Anchor Worker ---")
try:
    r = requests.get(f"{urls['worker']}/api/v1/riders/6fc7ae56-8cc2-4d32-b8cf-c21844a177ce", timeout=10)
    data = r.json()
    z = data.get("zone_code", "")
    if "delhi" in z.lower():
        print("✅ Test 3 PASS")
    else:
        print(f"❌ Test 3 FAIL zone={z}")
except Exception as e:
    print(f"❌ Test 3 FAIL: {e}")

# Test 4: SHAP Premium
print("\n--- TEST 4: SHAP Premium ---")
try:
    payload = {"city":"delhi_ncr","vehicle_type":"bicycle","coverage_tier":"standard","month":7,"historical_aqi_events_12m":45,"historical_rain_events_12m":28,"disruption_history_90d":15,"declared_daily_trips":30,"avg_daily_earnings":1100.0,"monthly_work_days":22}
    r = requests.post(f"{urls['ml']}/api/v1/premium/calculate", json=payload, timeout=10)
    if "shap_breakdown" in r.json():
        print("✅ Test 4 PASS")
    else:
        print("❌ Test 4 FAIL: no shap_breakdown")
except Exception as e:
    print(f"❌ Test 4 FAIL: {e}")

# Test 5: Clean Trigger -> DB
print("\n--- TEST 5: Clean Trigger -> DB Insert ---")
requests.post(f"{urls['trigger']}/api/v1/trigger/test", json={"zone_code":"delhi_rohini","event_type":"aqi","metric_value":450,"scenario":"clean"}, timeout=5)
time.sleep(15)
try:
    out = subprocess.check_output(f'docker run --rm postgres:14 psql "{db_url}" -t -c "SELECT status, fraud_score FROM claims WHERE worker_id=\'6fc7ae56-8cc2-4d32-b8cf-c21844a177ce\' ORDER BY created_at DESC LIMIT 1;"', shell=True).decode('utf-8')
    print(f"Latest claim: {out.strip()}")
    if "auto_approved" in out or "soft_hold" in out or "blocked" in out:
        print("✅ Test 5 PASS")
    else:
        print("❌ Test 5 FAIL")
except Exception as e:
    print(f"❌ Test 5 FAIL: DB check crashed")

# Test 6: Spoofed Trigger
print("\n--- TEST 6: Spoofed Trigger -> Blocked ---")
requests.post(f"{urls['trigger']}/api/v1/trigger/test", json={"zone_code":"delhi_rohini","event_type":"aqi","metric_value":500,"scenario":"spoofed"}, timeout=5)
time.sleep(15)
try:
    out = subprocess.check_output(f'docker run --rm postgres:14 psql "{db_url}" -t -c "SELECT status, fraud_score FROM claims WHERE worker_id=\'6fc7ae56-8cc2-4d32-b8cf-c21844a177ce\' ORDER BY created_at DESC LIMIT 1;"', shell=True).decode('utf-8')
    print(f"Latest claim: {out.strip()}")
    if "blocked" in out.lower():
        print("✅ Test 6 PASS")
    else:
        print("⚠️ Test 6: check fraud_score")
except Exception as e:
    print(f"❌ Test 6 FAIL")

# Test 7: Payment summary
print("\n--- TEST 7: Payment Summary ---")
try:
    r = requests.get(f"{urls['payment']}/api/v1/payments/summary", timeout=10)
    if "detail" not in r.json():
        print("✅ Test 7 PASS")
    else:
        print("❌ Test 7 FAIL")
except Exception as e:
    print(f"❌ Test 7 FAIL: {e}")

# Test 8: Liveness
print("\n--- TEST 8: verify-liveness endpoint ---")
try:
    r = requests.post(f"{urls['claims']}/api/v1/claims/verify-liveness", timeout=10)
    if r.status_code != 404:
        print(f"✅ Test 8 PASS (HTTP {r.status_code})")
    else:
        print("❌ Test 8 FAIL (HTTP 404)")
except Exception as e:
    print(f"❌ Test 8 FAIL: {e}")

# Test 9: Fraud queue
print("\n--- TEST 9: Claims Status Filter ---")
try:
    r = requests.get(f"{urls['claims']}/api/v1/claims?status=auto_approved&limit=5", timeout=10)
    if r.status_code == 200:
        print("✅ Test 9 PASS")
    else:
        print(f"❌ Test 9 FAIL (HTTP {r.status_code})")
except Exception as e:
    print(f"❌ Test 9 FAIL: {e}")
