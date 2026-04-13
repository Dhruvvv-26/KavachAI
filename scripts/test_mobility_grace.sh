#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# KavachAI — Cross-Zone Mobility Grace Proof Test
#
# Demonstrates that a rider registered in delhi_rohini receives a
# claim payout when a trigger fires in adjacent delhi_pitampura,
# where they are physically delivering (verified by GPS pings).
#
# Prerequisites:
#   - docker-compose up -d (all services running)
#   - python3 scripts/god_mode_demo.py seed (Arjun seeded)
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

WORKER_ID="6fc7ae56-8cc2-4d32-b8cf-c21844a177ce"
WORKER_URL="http://localhost:8001"
TRIGGER_URL="http://localhost:8003"
CLAIMS_URL="http://localhost:8004"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  KavachAI — Mobility Grace Window Proof Test${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

# ── Step 1: Confirm Arjun is seeded with delhi_rohini policy ───────
echo ""
echo -e "${YELLOW}Step 1: Seed demo rider (delhi_rohini policy)${NC}"
python3 scripts/god_mode_demo.py seed 2>&1 | tail -5
echo -e "${GREEN}  ✓ Arjun's policy is in delhi_rohini${NC}"

# ── Step 2: Insert 4 GPS pings into delhi_pitampura ────────────────
echo ""
echo -e "${YELLOW}Step 2: Inject 4 GPS pings into delhi_pitampura zone${NC}"
echo "  (Pitampura centroid: ~28.7050°N, 77.1370°E)"

# Coordinates known to fall inside delhi_pitampura polygon
PINGS=(
  '{"latitude": 28.7048, "longitude": 77.1368, "accuracy_metres": 8.5, "speed_kmh": 12.3}'
  '{"latitude": 28.7052, "longitude": 77.1372, "accuracy_metres": 7.2, "speed_kmh": 14.1}'
  '{"latitude": 28.7046, "longitude": 77.1365, "accuracy_metres": 9.1, "speed_kmh": 11.8}'
  '{"latitude": 28.7051, "longitude": 77.1371, "accuracy_metres": 6.8, "speed_kmh": 13.5}'
)

# NOTE: psql fallback in Step 2 bypasses GPS endpoint validation (mock location check,
# accuracy guard). This is intentional for test-only use — do not use in production flows.
# QA fix: C1
PING_SUCCESS=0
for i in "${!PINGS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${WORKER_URL}/api/v1/workers/${WORKER_ID}/gps-ping" \
    -H "Content-Type: application/json" \
    -d "${PINGS[$i]}")

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "  ${GREEN}✓ Ping $((i+1))/4 sent (HTTP ${HTTP_CODE})${NC}"
    PING_SUCCESS=$((PING_SUCCESS + 1))
  else
    echo -e "  ${RED}✗ Ping $((i+1))/4 failed (HTTP ${HTTP_CODE})${NC}"
  fi
  sleep 0.3
done

if [ "$PING_SUCCESS" -lt 3 ]; then
  echo -e "${RED}  ERROR: Need ≥3 pings for mobility grace. Only ${PING_SUCCESS} succeeded.${NC}"
  echo "  Falling back to direct DB insert..."
  PGPASSWORD=kavachai_secure_2026 psql -h localhost -U kavachai -d kavachai -c "
    -- QA fix: C
    INSERT INTO gps_pings (worker_id, location, accuracy_m, recorded_at)
    SELECT '${WORKER_ID}', ST_SetSRID(ST_MakePoint(77.1368, 28.7048), 4326), 8.5, NOW() - INTERVAL '10 minutes'
    UNION ALL SELECT '${WORKER_ID}', ST_SetSRID(ST_MakePoint(77.1372, 28.7052), 4326), 7.2, NOW() - INTERVAL '8 minutes'
    UNION ALL SELECT '${WORKER_ID}', ST_SetSRID(ST_MakePoint(77.1365, 28.7046), 4326), 9.1, NOW() - INTERVAL '5 minutes'
    UNION ALL SELECT '${WORKER_ID}', ST_SetSRID(ST_MakePoint(77.1371, 28.7051), 4326), 6.8, NOW() - INTERVAL '2 minutes'
    ON CONFLICT DO NOTHING;
  "
  echo -e "  ${GREEN}✓ Direct DB insert complete${NC}"
fi

# ── Step 3: Record baseline claim count ────────────────────────────
echo ""
echo -e "${YELLOW}Step 3: Record baseline claim count${NC}"
BASELINE=$(curl -s "${CLAIMS_URL}/api/v1/claims/worker/${WORKER_ID}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('claims',d if isinstance(d,list) else [])))" 2>/dev/null || echo "0")
echo "  Baseline: ${BASELINE} existing claims"

# ── Step 4: Fire AQI trigger in delhi_pitampura ────────────────────
echo ""
echo -e "${YELLOW}Step 4: Fire AQI trigger in delhi_pitampura${NC}"
TRIGGER_RESP=$(curl -s -X POST "${TRIGGER_URL}/api/v1/trigger/test" \
  -H "Content-Type: application/json" \
  -d '{
    "zone_code": "delhi_pitampura",
    "event_type": "aqi",
    "metric_value": 420,
    "scenario": "clean"
  }')

echo "$TRIGGER_RESP" | python3 -m json.tool 2>/dev/null || echo "$TRIGGER_RESP"

# ── Step 5: Poll for new claim (30s timeout) ───────────────────────
echo ""
echo -e "${YELLOW}Step 5: Polling for claim decision (30s timeout)${NC}"
CLAIM_FOUND=0
for i in $(seq 1 10); do
  sleep 3
  CURRENT=$(curl -s "${CLAIMS_URL}/api/v1/claims/worker/${WORKER_ID}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('claims',d if isinstance(d,list) else [])))" 2>/dev/null || echo "0")
  echo -n "  Poll ${i}/10 — claims: ${CURRENT}"

  if [ "${CURRENT}" -gt "${BASELINE}" ]; then
    echo -e " ${GREEN}← NEW CLAIM DETECTED!${NC}"
    CLAIM_FOUND=1
    break
  else
    echo ""
  fi
done

if [ "$CLAIM_FOUND" -eq 0 ]; then
  echo -e "${RED}  ✗ Timeout — no new claim appeared within 30 seconds${NC}"
  echo "  Check claims-service logs: docker logs claims-service --tail 50"
  exit 1
fi

# ── Step 6: Fetch & display the latest claim ───────────────────────
echo ""
echo -e "${YELLOW}Step 6: Fetching latest claim detail${NC}"
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"
curl -s "${CLAIMS_URL}/api/v1/claims/worker/${WORKER_ID}?limit=1" \
  | python3 -m json.tool
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"

# ── Verification Checklist ─────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  VERIFICATION CHECKLIST${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Look for these fields in the JSON output above:"
echo ""
echo -e "  ${CYAN}zone_match_type${NC}:        ${GREEN}\"mobility_grace\"${NC}"
echo -e "  ${CYAN}mobility_grace_penalty${NC}: ${GREEN}0.04${NC}"
echo -e "  ${CYAN}status${NC}:                 ${GREEN}\"auto_approved\"${NC} or ${YELLOW}\"soft_hold\"${NC}"
echo -e "  ${CYAN}fraud_flags${NC}:            should contain ${GREEN}\"MOBILITY_GRACE_APPLIED\"${NC}"
echo ""
echo "  If zone_match_type shows \"primary\" instead, the rider's GPS"
echo "  pings may not have landed inside the delhi_pitampura polygon."
echo "  Verify zone boundaries with: SELECT zone_code, ST_AsText(boundary)"
echo "  FROM zones WHERE zone_code = 'delhi_pitampura';"
echo ""
