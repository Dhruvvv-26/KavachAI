/**
 * index.tsx — KavachAI Worker App Home Screen
 * Rebuilds the Disruption Monitor with live ParameterBars + Phase 3 SOAR data.
 * Includes: permission handling, FCM trigger events, GPSCamera launch, countdown timer.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DEFAULT_THRESHOLDS,
  ParameterBar,
} from "../components/ParameterBar";
import {
  fetchHomeScreenData,
  HomeScreenData,
  PolicyData,
  SoarDisruptionPayload,
  TriggerStatus,
} from "../lib/api";
import { requestAllPermissions, PermissionStatus } from "../lib/permissionManager";
import GPSCamera from "../components/GPSCamera";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000; // 10-second polling — matches admin dashboard
const VERIFICATION_WINDOW_SECONDS = 300; // 5 minutes

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      {active && (
        <Animated.View
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#1D9E75",
            opacity: 0.3,
            transform: [{ scale: pulse }],
          }}
        />
      )}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? "#1D9E75" : "#52525B",
        }}
      />
    </View>
  );
}

function CoverageCard({ policy }: { policy: PolicyData | null }) {
  const isActive = policy?.status === "active";
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Coverage</Text>
        <View style={styles.row}>
          <StatusDot active={isActive} />
          <Text
            style={[
              styles.statusLabel,
              { color: isActive ? "#1D9E75" : "#71717A" },
            ]}
          >
            {policy ? (isActive ? "ACTIVE" : policy.status.toUpperCase()) : "—"}
          </Text>
        </View>
      </View>
      {policy ? (
        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tier</Text>
            <Text style={styles.metaValue}>
              {policy.coverage_tier.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Weekly premium</Text>
            <Text style={styles.metaValue}>₹{policy.weekly_premium_inr}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.skeletonBlock} />
      )}
    </View>
  );
}

function SoarHeaderBadge({ soar }: { soar: SoarDisruptionPayload | null }) {
  if (!soar) return null;
  const colors: Record<number, { bg: string; text: string; border: string }> = {
    0: { bg: "#14532D", text: "#86EFAC", border: "#166534" },
    1: { bg: "#713F12", text: "#FDE68A", border: "#92400E" },
    2: { bg: "#7F1D1D", text: "#FCA5A5", border: "#991B1B" },
  };
  const c = colors[soar.prediction_class] ?? colors[0];
  return (
    <View
      style={[
        styles.soarBadge,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Text style={[styles.soarBadgeText, { color: c.text }]}>
        ML: {soar.prediction_label} · {Math.round(soar.confidence * 100)}% conf
      </Text>
    </View>
  );
}

// ─── Permission Modal ─────────────────────────────────────────────────────────

function PermissionModal({
  visible,
  onRequestPermissions,
}: {
  visible: boolean;
  onRequestPermissions: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Permissions Required</Text>
          <Text style={styles.modalBody}>
            KavachAI needs access to your location and camera to verify your presence
            in the disruption zone and protect your payouts from fraud.
          </Text>
          <Text style={styles.modalBody}>
            Without these permissions, your claims cannot be processed.
          </Text>
          <TouchableOpacity style={styles.modalButton} onPress={onRequestPermissions}>
            <Text style={styles.modalButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Background Location Banner ───────────────────────────────────────────────

function BackgroundBanner({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.bgBanner}>
      <Text style={styles.bgBannerText}>
        Enable background location for uninterrupted fraud protection
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.bgBannerDismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Countdown Timer Component ────────────────────────────────────────────────

function Countdown({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isLow = seconds <= 60;
  return (
    <Text style={[styles.countdownText, isLow && { color: "#EF4444" }]}>
      {mins}:{secs.toString().padStart(2, "0")}
    </Text>
  );
}

// ─── Trigger Event Modal ──────────────────────────────────────────────────────

interface TriggerEventData {
  type: string;
  trigger_event_id: string;
  zone_code: string;
  event_type: string;
  metric_value: number;
}

function TriggerEventModal({
  visible,
  event,
  countdown,
  onVerifyNow,
  onDismiss,
}: {
  visible: boolean;
  event: TriggerEventData | null;
  countdown: number;
  onVerifyNow: () => void;
  onDismiss: () => void;
}) {
  if (!event) return null;
  const expired = countdown <= 0;
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.triggerCard}>
          <Text style={styles.triggerTitle}>⚠️ Disruption Detected</Text>
          <Text style={styles.triggerSubtitle}>
            {event.event_type.toUpperCase()} alert in {event.zone_code}
          </Text>

          <View style={styles.triggerMeta}>
            <View style={styles.triggerMetaRow}>
              <Text style={styles.triggerMetaLabel}>Event</Text>
              <Text style={styles.triggerMetaValue}>{event.event_type.toUpperCase()}</Text>
            </View>
            <View style={styles.triggerMetaRow}>
              <Text style={styles.triggerMetaLabel}>Value</Text>
              <Text style={styles.triggerMetaValue}>{event.metric_value}</Text>
            </View>
          </View>

          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>
              {expired ? "Verification window closed" : "Verify within"}
            </Text>
            {!expired && <Countdown seconds={countdown} />}
          </View>

          {!expired ? (
            <View style={styles.triggerActions}>
              <TouchableOpacity style={styles.verifyButton} onPress={onVerifyNow}>
                <Text style={styles.verifyButtonText}>Verify Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.remindButton} onPress={onDismiss}>
                <Text style={styles.remindButtonText}>Remind Me Later</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.remindButton} onPress={onDismiss}>
              <Text style={styles.remindButtonText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [data, setData] = useState<HomeScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mlOnline, setMlOnline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Permission state
  const [permStatus, setPermStatus] = useState<PermissionStatus | null>(null);
  const [showPermModal, setShowPermModal] = useState(false);
  const [showBgBanner, setShowBgBanner] = useState(false);

  // Trigger event state
  const [triggerEvent, setTriggerEvent] = useState<TriggerEventData | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [countdown, setCountdown] = useState(VERIFICATION_WINDOW_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // GPSCamera state
  const [showCamera, setShowCamera] = useState(false);

  // ── Permission handling on mount ─────────────────────────────────────────
  useEffect(() => {
    async function checkPermissions() {
      const result = await requestAllPermissions();
      setPermStatus(result);

      if (!result.all_critical_granted) {
        setShowPermModal(true);
      } else if (!result.background_granted) {
        setShowBgBanner(true);
      }
    }
    checkPermissions();
  }, []);

  const handleRequestPermissions = useCallback(async () => {
    const result = await requestAllPermissions();
    setPermStatus(result);
    if (result.all_critical_granted) {
      setShowPermModal(false);
      if (!result.background_granted) {
        setShowBgBanner(true);
      }
    }
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await fetchHomeScreenData();
    setData(result);
    setMlOnline(result.soar !== null);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // ── FCM / Trigger Event simulation listener ──────────────────────────────
  // In production this would listen to expo-notifications for FCM payloads.
  // For demo: we check trigger status and simulate if an active event exists.
  useEffect(() => {
    if (!data?.triggerStatus) return;
    const ts = data.triggerStatus as any;
    if (ts.active_event && ts.event_type && !triggerEvent) {
      const event: TriggerEventData = {
        type: "TRIGGER_EVENT",
        trigger_event_id: `trigger_${Date.now()}`,
        zone_code: ts.zone_code || "delhi_rohini",
        event_type: ts.event_type || "aqi",
        metric_value: ts.current_aqi || ts.current_rain_mm || ts.current_temp_c || 0,
      };
      setTriggerEvent(event);
      setShowTriggerModal(true);
      setCountdown(VERIFICATION_WINDOW_SECONDS);
    }
  }, [data?.triggerStatus]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (showTriggerModal && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [showTriggerModal]);

  // ── GPSCamera handlers ───────────────────────────────────────────────────
  const handleVerifyNow = () => {
    setShowTriggerModal(false);
    setShowCamera(true);
  };

  const handleCameraCapture = (payload: any) => {
    setShowCamera(false);
    // Success toast handled by the camera component's onCapture
    console.log("[HomeScreen] GPSCamera capture success:", payload);
    load(true); // Refresh data
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
  };

  const handleTriggerDismiss = () => {
    setShowTriggerModal(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // Derive display values with null safety at the boundary
  const trigger: TriggerStatus | null = data?.triggerStatus ?? null;
  const soar: SoarDisruptionPayload | null = data?.soar ?? null;
  const policy: PolicyData | null = data?.policy ?? null;

  // Resolve per-factor ML confidence from SOAR contributing_factors
  const aqiConf = soar?.contributing_factors?.aqi_probability ?? null;
  const rainConf = soar?.contributing_factors?.rain_probability ?? null;
  const heatConf = soar?.contributing_factors?.heat_probability ?? null;
  const disruptConf = soar?.contributing_factors?.disruption_index ?? null;

  // Policy thresholds override defaults when available
  const aqiThreshold = policy?.triggers?.aqi_threshold ?? DEFAULT_THRESHOLDS.aqi.critical;
  const rainThreshold = policy?.triggers?.rain_threshold_mm ?? DEFAULT_THRESHOLDS.rain.critical;
  const heatThreshold = policy?.triggers?.heat_threshold_c ?? DEFAULT_THRESHOLDS.heat.critical;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor="#1D9E75"
        />
      }
    >
      {/* ── Permission Modal ── */}
      <PermissionModal
        visible={showPermModal}
        onRequestPermissions={handleRequestPermissions}
      />

      {/* ── Background Location Banner ── */}
      <BackgroundBanner
        visible={showBgBanner}
        onDismiss={() => setShowBgBanner(false)}
      />

      {/* ── Trigger Event Modal ── */}
      <TriggerEventModal
        visible={showTriggerModal}
        event={triggerEvent}
        countdown={countdown}
        onVerifyNow={handleVerifyNow}
        onDismiss={handleTriggerDismiss}
      />

      {/* ── GPSCamera Modal ── */}
      <Modal visible={showCamera} animationType="slide">
        <GPSCamera
          onCapture={handleCameraCapture}
          onCancel={handleCameraCancel}
        />
      </Modal>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>KavachAI</Text>
          <Text style={styles.screenSubtitle}>
            {data?.worker?.name ?? "Loading..."}
            {data?.worker?.zone_code ? ` · ${data.worker.zone_code}` : ""}
          </Text>
        </View>
        <View style={styles.mlIndicator}>
          <StatusDot active={mlOnline} />
          <Text style={[styles.mlLabel, { color: mlOnline ? "#1D9E75" : "#71717A" }]}>
            ML {mlOnline ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      {/* ── SOAR Tier Badge ── */}
      <SoarHeaderBadge soar={soar} />

      {/* ── Coverage card ── */}
      <CoverageCard policy={policy} />

      {/* ── Disruption Monitor ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Disruption Monitor</Text>
        {lastUpdated && (
          <Text style={styles.sectionMeta}>
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#1D9E75" style={{ marginTop: 24 }} />
      ) : (
        <>
          <ParameterBar
            label="Air Quality Index"
            type="aqi"
            currentValue={trigger?.current_aqi}
            thresholds={{
              ...DEFAULT_THRESHOLDS.aqi,
              critical: aqiThreshold,
            }}
            mlConfidence={aqiConf}
            mlTierLabel={
              (aqiConf ?? 0) >= 0.7
                ? soar?.prediction_label
                : undefined
            }
          />

          <ParameterBar
            label="Rainfall"
            type="rain"
            currentValue={trigger?.current_rain_mm}
            thresholds={{
              ...DEFAULT_THRESHOLDS.rain,
              critical: rainThreshold,
            }}
            mlConfidence={rainConf}
          />

          <ParameterBar
            label="Heat Index"
            type="heat"
            currentValue={trigger?.current_temp_c}
            thresholds={{
              ...DEFAULT_THRESHOLDS.heat,
              critical: heatThreshold,
            }}
            mlConfidence={heatConf}
          />

          <ParameterBar
            label="Overall Disruption Risk"
            type="disruption"
            currentValue={disruptConf}
            thresholds={DEFAULT_THRESHOLDS.disruption}
            mlConfidence={soar?.confidence}
            mlTierLabel={soar?.prediction_label}
          />
        </>
      )}

      {/* ── Quick actions ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>My Payouts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>My Policy</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#09090B", // zinc-950
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    marginTop: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#F4F4F5",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
  mlIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#18181B",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: "#3F3F46",
  },
  mlLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  soarBadge: {
    borderRadius: 8,
    borderWidth: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    alignSelf: "stretch",
  },
  soarBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: "#18181B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#3F3F46",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A1A1AA",
    letterSpacing: 0.3,
  },
  cardBody: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontSize: 12,
    color: "#71717A",
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#F4F4F5",
  },
  skeletonBlock: {
    height: 32,
    borderRadius: 6,
    backgroundColor: "#27272A",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionMeta: {
    fontSize: 11,
    color: "#52525B",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#18181B",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#3F3F46",
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2DD4BF", // teal-400
  },
  // Permission modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#18181B",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#3F3F46",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F4F4F5",
    marginBottom: 12,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    color: "#A1A1AA",
    marginBottom: 12,
    lineHeight: 20,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#00C9B1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Background banner
  bgBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(245, 158, 11, 0.3)",
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bgBannerText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  bgBannerDismiss: {
    color: "#F59E0B",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  // Trigger event modal
  triggerCard: {
    backgroundColor: "#18181B",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  triggerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F4F4F5",
    textAlign: "center",
    marginBottom: 8,
  },
  triggerSubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 20,
  },
  triggerMeta: {
    backgroundColor: "#27272A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  triggerMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  triggerMetaLabel: {
    fontSize: 12,
    color: "#71717A",
  },
  triggerMetaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F4F4F5",
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 12,
    color: "#71717A",
    marginBottom: 4,
  },
  countdownText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#F59E0B",
    fontVariant: ["tabular-nums"],
  },
  triggerActions: {
    gap: 10,
  },
  verifyButton: {
    backgroundColor: "#00C9B1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  remindButton: {
    borderWidth: 1,
    borderColor: "#3F3F46",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  remindButtonText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "500",
  },
});
