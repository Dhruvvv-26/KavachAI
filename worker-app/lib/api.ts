/**
 * KavachAI Worker App — Production API Client (Phase 3 SOAR)
 *
 * All service URLs are driven by EXPO_PUBLIC_* environment variables.
 * Route prefixes match the ACTUAL backend FastAPI routes:
 *   - Worker Service:  /api/v1/riders
 *   - Policy Service:  /api/v1/policies, /api/v1/premium
 *   - Trigger Service: /api/v1/trigger
 *   - Claims Service:  /api/v1/claims
 *   - Payment Service: /api/v1/payments
 *   - ML Service:      /api/v1/premium, /api/v1/fraud, /api/v1/predict
 */

// ── Service URLs sourced from env vars ─────────────────────────────────────

const API_HOST = process.env.EXPO_PUBLIC_API_HOST ?? "localhost";

export const WORKER_ID =
  process.env.EXPO_PUBLIC_WORKER_ID ?? "6fc7ae56-8cc2-4d32-b8cf-c21844a177ce";

export const SERVICES = {
  worker:  process.env.EXPO_PUBLIC_WORKER_SERVICE  ?? `http://${API_HOST}:8001`,
  policy:  process.env.EXPO_PUBLIC_TUNNEL_POLICY   ?? process.env.EXPO_PUBLIC_POLICY_SERVICE  ?? `http://${API_HOST}:8002`,
  trigger: process.env.EXPO_PUBLIC_TRIGGER_SERVICE  ?? `http://${API_HOST}:8003`,
  claims:  process.env.EXPO_PUBLIC_TUNNEL_CLAIMS   ?? process.env.EXPO_PUBLIC_CLAIMS_SERVICE  ?? `http://${API_HOST}:8004`,
  payment: process.env.EXPO_PUBLIC_PAYMENT_SERVICE  ?? `http://${API_HOST}:8005`,
  ml:      process.env.EXPO_PUBLIC_ML_SERVICE       ?? `http://${API_HOST}:8006`,
};

// ── Common headers (bypass-tunnel-reminder for loca.lt tunnels) ────────────

const HEADERS: Record<string, string> = {
  "bypass-tunnel-reminder": "true",
  "Content-Type": "application/json",
};

// ── Helper ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...HEADERS, ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error(`❌ API Error [${url}]:`, e);
    return null;
  }
}

// ── Worker Service (8001) — prefix: /api/v1/riders ─────────────────────────

export const getWorkerProfile = async (workerId?: string) => {
  const wid = workerId || WORKER_ID;
  console.log("📡 [PROD] Fetching Worker Profile...");
  return apiFetch<WorkerProfile>(`${SERVICES.worker}/api/v1/riders/${wid}`);
};

export const updateGPSPing = async (
  workerId: string, lat: number, lon: number, accuracy: number
): Promise<void> => {
  console.log("📡 [PROD] Sending GPS Ping...");
  await apiFetch(`${SERVICES.worker}/api/v1/riders/${workerId}/gps-ping`, {
    method: "POST",
    body: JSON.stringify({ latitude: lat, longitude: lon, accuracy }),
  });
};

// ── Policy Service (8002) — prefix: /api/v1/policies ───────────────────────

export const getActivePolicy = async () => {
  console.log("📡 [PROD] Fetching Policy...");
  const data = await apiFetch<{ policies: any[]; active_count: number }>(
    `${SERVICES.policy}/api/v1/policies/worker/${WORKER_ID}`
  );
  if (!data?.policies?.length) return null;
  const policy =
    data.policies.find((p: any) => p.status === "active") || data.policies[0];
  return {
    ...policy,
    tier: policy.coverage_tier,
    premium_amount: policy.weekly_premium,
    max_payout_amount: policy.max_payout_per_event,
    end_date: policy.coverage_end,
    start_date: policy.coverage_start,
  };
};

export const getWorkerPolicy = async (workerId: string) => {
  console.log("📡 [PROD] Fetching Worker Policy...");
  return apiFetch(`${SERVICES.policy}/api/v1/policies/worker/${workerId}`);
};

export const getPremiumBreakdown = async (workerId?: string) => {
  console.log("📡 [PROD] Fetching Premium Breakdown (SHAP)...");
  // The ML service calculates premium with SHAP breakdown
  // We need registration data to populate the request
  const wid = workerId || WORKER_ID;
  const worker = await getWorkerProfile(wid);

  const requestBody = {
    city: "delhi_ncr",
    vehicle_type: (worker as any)?.vehicle_type || "bicycle",
    coverage_tier: "standard",
    month: new Date().getMonth() + 1,
    historical_aqi_events_12m: 45,
    historical_rain_events_12m: 28,
    disruption_history_90d: 15,
    declared_daily_trips: 30,
    avg_daily_earnings: 1100.0,
    monthly_work_days: 22,
  };

  return calculatePremium(requestBody);
};

// ── Trigger Service (8003) — prefix: /api/v1/trigger ───────────────────────

export const getZoneWeather = async () => {
  console.log("📡 [PROD] Fetching Zone Weather / Triggers...");
  return apiFetch(`${SERVICES.trigger}/api/v1/trigger/status`);
};

export const getTriggerStatus = async () => {
  console.log("📡 [PROD] Fetching Trigger Status...");
  return apiFetch(`${SERVICES.trigger}/api/v1/trigger/status`);
};

export const getZoneTriggerHistory = async (zoneCode: string) => {
  console.log("📡 [PROD] Fetching Zone Trigger History...");
  return apiFetch(`${SERVICES.trigger}/api/v1/trigger/history?zone_code=${zoneCode}`);
};

// ── Claims Service (8004) — prefix: /api/v1/claims ─────────────────────────

export const getWorkerClaims = async () => {
  console.log("📡 [PROD] Fetching Claims...");
  const data = await apiFetch<{ claims: any[] }>(
    `${SERVICES.claims}/api/v1/claims/worker/${WORKER_ID}`
  );
  return data?.claims ?? [];
};

export const sendSensorPing = async (sensorData: Record<string, any>) => {
  console.log("📡 [PROD] Sending Sensor Ping...");
  return apiFetch(
    `${SERVICES.claims}/api/v1/claims/sensor_data/${WORKER_ID}`,
    { method: "POST", body: JSON.stringify(sensorData) }
  );
};

export const submitLivenessVerification = async (formData: FormData) => {
  console.log("📡 [PROD] Submitting Liveness Verification...");
  try {
    const response = await fetch(
      `${SERVICES.claims}/api/v1/claims/verify-liveness`,
      {
        method: "POST",
        body: formData,
        headers: { "bypass-tunnel-reminder": "true" },
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error("❌ Liveness verification error:", e);
    return null;
  }
};

// ── Payment Service (8005) — prefix: /api/v1/payments ──────────────────────

export const getWorkerPayments = async () => {
  console.log("📡 [PROD] Fetching Payments...");
  const data = await apiFetch<{ payments: any[] }>(
    `${SERVICES.payment}/api/v1/payments/worker/${WORKER_ID}`
  );
  return data?.payments ?? [];
};

export const getPaymentSummary = async () => {
  console.log("📡 [PROD] Fetching Payment Summary...");
  return apiFetch(`${SERVICES.payment}/api/v1/payments/summary`);
};

export const fetchPaymentSummaryPublic = async () => {
  console.log("📡 [PROD] Fetching Payment Summary (BCR)...");
  return apiFetch<{
    total_premiums_this_week: number;
    total_payouts_this_week: number;
    loss_ratio_percent: number;
    burning_cost_rate: number;
    bcr_status: string;
    reserve_ratio: number;
  }>(`${SERVICES.payment}/api/v1/payments/summary`);
};

// ── ML Service (8006) — prefix: /api/v1/premium, /api/v1/predict ───────────

export const calculatePremium = async (params: PremiumParams) => {
  console.log("📡 [PROD] Calculating Premium (SHAP)...");
  return apiFetch<PremiumResult>(
    `${SERVICES.ml}/api/v1/premium/calculate`,
    { method: "POST", body: JSON.stringify(params) }
  );
};

export const getZonePrediction = async (zoneCode: string) => {
  console.log("📡 [PROD] Fetching Zone Prediction (LSTM)...");
  return apiFetch(`${SERVICES.ml}/api/v1/predict/disruption?zone_code=${zoneCode}`);
};

// ── Phase 3 additions ──────────────────────────────────────────────────────

export const fetchPolicyExclusions = async () => {
  console.log("📡 [PROD] Fetching Force Majeure Exclusions...");
  return apiFetch<{ exclusions: Array<{ code: string; label: string; description: string }> }>(
    `${SERVICES.policy}/api/v1/policies/exclusions/reference`
  );
};

export async function getActiveDisruptions(): Promise<SoarDisruptionPayload | null> {
  console.log("📡 [PROD] Fetching Active Disruptions (SOAR)...");
  return apiFetch(`${SERVICES.ml}/api/v1/predict/disruptions/active`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerProfile {
  worker_id: string;
  name: string;
  zone_code: string;
  vehicle_type: string;
}

export interface PolicyData {
  policy_id: string;
  status: "active" | "inactive" | "expired";
  coverage_tier: string;
  weekly_premium_inr: number;
  triggers: {
    aqi_threshold: number;
    rain_threshold_mm: number;
    heat_threshold_c: number;
  };
}

export interface ClaimRecord {
  claim_id: string;
  event_type: string;
  payout_inr: number;
  status: "approved" | "rejected" | "pending";
  created_at: string;
}

export interface PaymentSummary {
  total_premiums_inr: number;
  total_payouts_inr: number;
  loss_ratio: number;
  pending_payouts: number;
}

export interface TriggerStatus {
  zone_code: string;
  current_aqi: number | null;
  current_rain_mm: number | null;
  current_temp_c: number | null;
  active_event: boolean;
  event_type: string | null;
}

export interface SoarDisruptionPayload {
  zone_code: string;
  prediction_class: 0 | 1 | 2;
  prediction_label: "Normal" | "Tier 1" | "Force Majeure";
  confidence: number;
  contributing_factors: {
    aqi_probability: number;
    rain_probability: number;
    heat_probability: number;
    disruption_index: number;
  };
  model_version: string;
  evaluated_at: string;
}

export interface PremiumParams {
  city: string;
  vehicle_type: string;
  coverage_tier: string;
  month: number;
  historical_aqi_events_12m: number;
  historical_rain_events_12m: number;
  disruption_history_90d: number;
  declared_daily_trips: number;
  avg_daily_earnings: number;
  monthly_work_days: number;
}

export interface PremiumResult {
  recommended_premium: number;
  shap_breakdown: Record<string, number>;
  model_version: string;
  confidence: number;
}

export interface HomeScreenData {
  worker: any | null;
  policy: any | null;
  triggerStatus: any | null;
  soar: SoarDisruptionPayload | null;
  claims: any[] | null;
}

export async function fetchHomeScreenData(): Promise<HomeScreenData> {
  const [worker, policy, triggerStatus, soar, claims] = await Promise.all([
    getWorkerProfile(),
    getActivePolicy(),
    getZoneWeather(),
    getActiveDisruptions(),
    getWorkerClaims(),
  ]);
  return { worker, policy, triggerStatus, soar, claims };
}
