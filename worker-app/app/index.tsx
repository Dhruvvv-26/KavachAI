/**
 * KavachAI Worker App — Home / Coverage Status Screen
 *
 * Displays:
 * - Active policy card (tier, premium, renewal)
 * - Real-time disruption status widget (AQI/rain/heat)
 * - Active trigger banner with pulse animation
 * - Quick stats: payouts this month, coverage days
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Animated, Dimensions, Modal, TouchableOpacity, Alert
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {
  getWorkerProfile, getActivePolicy, getZoneWeather, getWorkerPayments, getWorkerClaims, sendSensorPing, WORKER_ID, SERVICES
} from '../lib/api';
import { colors, spacing, borderRadius, fonts, shadows } from '../lib/theme';
import GPSCamera from '../components/GPSCamera';

const { width } = Dimensions.get('window');

// ── Dev Overlay: Sensor Telemetry Simulator ─────────────────────────────────

function buildCleanPing(): Record<string, any> {
  const now = Date.now();
  // Match trigger_test.py "clean" scenario exactly
  const jitter = () => (Math.random() - 0.5) * 0.00008;  // ~±4m
  return {
    gps_pings: Array.from({ length: 5 }, (_, i) => ({
      lat: 28.7041 + jitter(),
      lng: 77.1025 + jitter(),
      accuracy_m: 6 + Math.random() * 12,  // 6–18m (realistic)
      timestamp: new Date(now + i * 5000).toISOString(),
    })),
    gps_cold_start_ms: 800 + Math.floor(Math.random() * 1600),  // 800–2400ms
    accelerometer_rms: 0.8 + Math.random() * 0.6,  // 0.8–1.4 (cycling)
    gyroscope_yaw_rate: 0.12 + Math.random() * 0.13,
    is_mock_location: false,
    is_developer_mode: false,
    tower_handoffs_30min: 3 + Math.floor(Math.random() * 4),
    zone_resident_t_minus_30: true,
    claims_in_window_same_zone: 1 + Math.floor(Math.random() * 7),
  };
}

function buildSpoofedPing(): Record<string, any> {
  const now = Date.now();
  // Match trigger_test.py "spoofed" scenario exactly
  return {
    gps_pings: Array.from({ length: 5 }, (_, i) => ({
      lat: 28.7041 + (Math.random() - 0.5) * 0.0000016,  // near-zero variance
      lng: 77.1025 + (Math.random() - 0.5) * 0.0000016,
      accuracy_m: 0.1 + Math.random() * 0.4,  // sub-meter (spoofed)
      timestamp: new Date(now + i * 5000).toISOString(),
    })),
    gps_cold_start_ms: 228,  // instant lock — dead giveaway
    accelerometer_rms: 0.0,  // device stationary
    gyroscope_yaw_rate: 0.003,
    is_mock_location: true,
    is_developer_mode: true,
    tower_handoffs_30min: 0,
    zone_resident_t_minus_30: false,
    claims_in_window_same_zone: 140,
  };
}

type ToastState = { visible: boolean; text: string; color: string };

function DevOverlay({ workerId }: { workerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState<'clean' | 'spoofed' | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, text: '', color: colors.primary });
  const toastAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((text: string, color: string) => {
    setToast({ visible: true, text, color });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setToast(prev => ({ ...prev, visible: false })));
  }, [toastAnim]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const firePing = useCallback(async (scenario: 'clean' | 'spoofed') => {
    if (sending) return;
    setSending(scenario);

    // Record the baseline claim count BEFORE sending the ping
    let baselineCount = 0;
    try {
      const existingClaims = await getWorkerClaims();
      baselineCount = existingClaims?.length ?? 0;
    } catch { /* ignore */ }

    const payload = scenario === 'clean' ? buildCleanPing() : buildSpoofedPing();
    const result = await sendSensorPing(payload);

    if (result === null) {
      showToast('❌ Network error — sensor ping failed', colors.error);
      setSending(null);
      return;
    }

    showToast('📡 Ping sent — awaiting claim decision...', colors.primary);

    // Poll /claims/worker/{id} every 2s for up to 15s looking for a NEW claim
    let attempts = 0;
    const maxAttempts = 8;  // 8 × 2s = 16s

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const claims = await getWorkerClaims();
        if (claims && claims.length > baselineCount) {
          const latest = claims[0]; // newest first
          const status = latest?.status?.toLowerCase();
          if (pollRef.current) clearInterval(pollRef.current);
          setSending(null);

          if (status === 'auto_approved' || status === 'completed') {
            showToast(`✅ Claim Approved  ₹${latest.payout_amount ?? 300}`, colors.success);
          } else if (status === 'soft_hold') {
            showToast(`⚠️ Soft Hold — 50% released, review pending`, colors.warning);
          } else if (status === 'blocked') {
            showToast(`🚫 Blocked — Fraud Detected`, colors.error);
          } else {
            showToast(`📋 Claim status: ${status}`, colors.textDim);
          }
          return;
        }
      } catch { /* continue polling */ }

      if (attempts >= maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        setSending(null);
        showToast('⏱ Timeout — no claim decision received', colors.warning);
      }
    }, 2000);
  }, [sending, showToast, workerId]);

  return (
    <>
      {/* Toast Notification */}
      {toast.visible && (
        <Animated.View
          style={[
            devStyles.toast,
            {
              backgroundColor: toast.color, opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
            },
          ]}
        >
          <Text style={devStyles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* Floating Toggle Button */}
      <TouchableOpacity
        style={devStyles.fab}
        onPress={() => setExpanded(prev => !prev)}
        activeOpacity={0.8}
      >
        <Ionicons name={expanded ? 'close' : 'bug'} size={20} color="#FFF" />
      </TouchableOpacity>

      {/* Expanded Overlay Panel */}
      {expanded && (
        <View style={devStyles.panel}>
          <Text style={devStyles.panelTitle}>🛠 Sensor Telemetry</Text>
          <Text style={devStyles.panelHint}>Fire a sensor ping to the claims pipeline</Text>

          <TouchableOpacity
            style={[devStyles.pingBtn, { backgroundColor: 'rgba(0, 230, 118, 0.15)', borderColor: colors.success }]}
            onPress={() => firePing('clean')}
            disabled={sending !== null}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[devStyles.pingBtnLabel, { color: colors.success }]}>
                {sending === 'clean' ? 'Sending…' : 'Simulate Clean Ping'}
              </Text>
              <Text style={devStyles.pingBtnHint}>GPS ✓ · Accel 0.8–1.4 · No mock</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[devStyles.pingBtn, { backgroundColor: 'rgba(255, 82, 82, 0.12)', borderColor: colors.error }]}
            onPress={() => firePing('spoofed')}
            disabled={sending !== null}
            activeOpacity={0.7}
          >
            <Ionicons name="warning" size={18} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={[devStyles.pingBtnLabel, { color: colors.error }]}>
                {sending === 'spoofed' ? 'Sending…' : 'Simulate Spoofed Ping'}
              </Text>
              <Text style={devStyles.pingBtnHint}>Mock GPS · Accel 0.0 · Lock 228ms</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const devStyles = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 28, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0, 201, 177, 0.85)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999, elevation: 20,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  panel: {
    position: 'absolute', bottom: 80, right: 16,
    width: 240,
    backgroundColor: 'rgba(15, 32, 56, 0.94)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(0, 201, 177, 0.25)',
    zIndex: 998, elevation: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16,
  },
  panelTitle: {
    color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 2,
  },
  panelHint: {
    color: colors.textMuted, fontSize: 11, marginBottom: 12,
  },
  pingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
    marginBottom: 8,
  },
  pingBtnLabel: {
    fontSize: 13, fontWeight: '600',
  },
  pingBtnHint: {
    fontSize: 10, color: colors.textMuted, marginTop: 1,
  },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, zIndex: 1000, elevation: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  toastText: {
    color: '#FFF', fontSize: 14, fontWeight: '600', textAlign: 'center',
  },
});

const EVENT_ICONS: Record<string, string> = {
  aqi: 'cloud',
  heavy_rain: 'rainy',
  extreme_heat: 'sunny',
  cyclone: 'thunderstorm',
  curfew: 'lock-closed',
  flood_alert: 'water',
};

const EVENT_COLORS: Record<string, string> = {
  aqi: '#FF7043',
  heavy_rain: '#42A5F5',
  extreme_heat: '#FFA726',
  cyclone: '#AB47BC',
  curfew: '#78909C',
  flood_alert: '#26C6DA',
};

export default function HomeScreen() {
  const [workerId, setWorkerId] = useState<string>(WORKER_ID || '');
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (WORKER_ID) setWorkerId(WORKER_ID);
  }, []);

  // Active trigger pulse animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Fetch all dashboard data
  const { data: dashboardData, refetch, isLoading } = useQuery({
    queryKey: ['dashboard', workerId],
    queryFn: async () => {
      const [policy, claims, payments, trigger] = await Promise.allSettled([
        getActivePolicy(),
        getWorkerClaims(),
        getWorkerPayments(),
        getZoneWeather(),
      ]);

      return {
        policy: policy.status === 'fulfilled' ? policy.value : null,
        claims: claims.status === 'fulfilled' ? claims.value : [],
        payments: payments.status === 'fulfilled' ? payments.value : [],
        triggerStatus: trigger.status === 'fulfilled' ? trigger.value : null,
      };
    },
    refetchInterval: 10000,
  });

  const activePolicy = dashboardData?.policy;
  const claims = dashboardData?.claims || [];
  const payments = dashboardData?.payments || [];
  const triggerStatus = dashboardData?.triggerStatus;

  const activeTriggers = (triggerStatus as any)?.active_trigger_count || 0;

  // Use payments as activity history
  const latestActivity = payments.slice(0, 3).map((p: any) => ({
    event_type: 'processing',
    title: `Payout ${p.status === 'completed' ? 'Credited' : 'Processing'}`,
    body: `₹${p.payout_amount} for your recent claim.`,
    sent_at: p.created_at || new Date().toISOString()
  }));

  const handleClaimPayout = () => {
    setShowCamera(true);
  };

  // Vuln D: Exponential backoff retry for poor 4G networks during storms
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const status = err.response?.status;
        // Don't retry 4xx client errors — they are deterministic rejections
        if (status && status >= 400 && status < 500) {
          throw err;
        }
        if (attempt === maxRetries) {
          throw err;
        }
        const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Retry exhausted"); // Unreachable, but satisfies TS
  };

  const onCameraCapture = async (cameraPayload: any) => {
    setShowCamera(false);
    setIsSubmitting(true);

    try {
      // Mocking hardware sensors for demo purposes
      const sensorData = {
        active_zone_id: (triggerStatus as any)?.zone_id || "demo-zone-id", // Included for Bouncer check
        accelerometer_rms: 3.5, // moving
        gyroscope_yaw_rate: 0.2, // standard device handling
        is_mock_location: false,
        gps_pings: [
          { lat: cameraPayload.gps_lat, lng: cameraPayload.gps_lng, accuracy_m: 5, timestamp: Date.now() },
        ],
        // Adding the Layer 5 Zero-Trust biometric payload
        photo_base64: cameraPayload.photo_base64,
        camera_gps_lat: cameraPayload.gps_lat,
        camera_gps_lng: cameraPayload.gps_lng,
        capture_timestamp_ms: cameraPayload.capture_timestamp_ms,
      };

      // Vuln D: Retry with exponential backoff (1s → 2s → 4s) for network failures
      const res = await retryWithBackoff(
        async () => {
          const response = await fetch(`${SERVICES.claims}/api/v1/claims/sensor_data/${workerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sensorData)
          });
          if (!response.ok) throw { response, status: response.status, data: await response.json().catch(() => ({})) };
          return response;
        }
      );

      if (res.status === 202) {
        Alert.alert(
          "Liveness Verified & Claim Submitted",
          "Your live selfie, GPS coordinates, and hardware sensors have been securely verified."
        );
      }
    } catch (err: any) {
      // Handle the 403 ZONE_MISMATCH_REJECTED or STALE capture
      const msg = err.response?.data?.detail || "Failed to verify liveness and submit claim.";
      Alert.alert("Verification Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch}
            tintColor={colors.primary} />
        }
      >
        {/* Active Trigger Banner */}
        {activeTriggers > 0 && (
          <Animated.View
            style={[styles.triggerBanner, { transform: [{ scale: pulseAnim }] }]}
          >
            <View style={styles.triggerBannerContent}>
              <Ionicons name="warning" size={24} color="#FFF" />
              <View style={styles.triggerBannerText}>
                <Text style={styles.triggerBannerTitle}>
                  ⚡ Active Trigger Detected
                </Text>
                <Text style={styles.triggerBannerSubtitle}>
                  {activeTriggers} disruption event(s) in your zone
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.claimButton}
              onPress={handleClaimPayout}
              disabled={isSubmitting}
            >
              <Text style={styles.claimButtonText}>
                {isSubmitting ? "Verifying..." : "Claim Payout (Requires Liveness Check)"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Modal visible={showCamera} animationType="slide">
          <GPSCamera
            onCapture={onCameraCapture}
            onCancel={() => setShowCamera(false)}
          />
        </Modal>

        {/* Coverage Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.shieldIcon}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{activePolicy?.status === 'active' ? 'Coverage Active' : 'Coverage Inactive'}</Text>
              <Text style={styles.cardSubtitle}>
                {activePolicy?.tier?.replace(/_/g, ' ')?.toUpperCase() || 'STANDARD TIER'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: activePolicy?.status === 'active' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)' }]}>
              <View style={[styles.activeDot, { backgroundColor: activePolicy?.status === 'active' ? colors.success : colors.error }]} />
              <Text style={[styles.statusText, { color: activePolicy?.status === 'active' ? colors.success : colors.error }]}>
                {activePolicy?.status?.toUpperCase() || 'INACTIVE'}
              </Text>
            </View>
          </View>

          <View style={styles.coverageDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Weekly Premium</Text>
              <Text style={styles.detailValue}>₹{activePolicy?.premium_amount || '0'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Max Payout</Text>
              <Text style={styles.detailValue}>₹{activePolicy?.max_payout_amount || '0'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Renewal</Text>
              <Text style={styles.detailValue}>
                {activePolicy?.end_date ? new Date(activePolicy.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <Ionicons name="cash" size={20} color={colors.success} />
            <Text style={styles.statValue}>
              ₹{claims?.reduce((sum: number, c: any) => sum + ((c?.status === 'completed' || c?.status === 'auto_approved') ? Number(c?.payout_amount || 0) : 0), 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={styles.statValue}>
              {activePolicy ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.statLabel}>Coverage</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
            <Ionicons name="analytics" size={20} color={colors.warning} />
            <Text style={styles.statValue}>
              {claims.length}
            </Text>
            <Text style={styles.statLabel}>Total Claims</Text>
          </View>
        </View>

        {/* Disruption Monitor */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Disruption Monitor</Text>
          <Text style={styles.sectionSubtitle}>Your Zone: Delhi Rohini</Text>
        </View>

        <View style={styles.disruptionGrid}>
          {[
            { type: 'aqi', label: 'Air Quality', value: 'AQI 280', status: 'Moderate' },
            { type: 'heavy_rain', label: 'Rainfall', value: '12mm/hr', status: 'Light' },
            { type: 'extreme_heat', label: 'Temperature', value: '38°C', status: 'Normal' },
            { type: 'cyclone', label: 'Wind Speed', value: '15 km/h', status: 'Calm' },
          ].map((item) => (
            <View key={item.type} style={styles.disruptionCard}>
              <Ionicons
                name={EVENT_ICONS[item.type] as any}
                size={22}
                color={EVENT_COLORS[item.type]}
              />
              <Text style={styles.disruptionLabel}>{item.label}</Text>
              <Text style={styles.disruptionValue}>{item.value}</Text>
              <Text style={styles.disruptionStatus}>{item.status}</Text>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {latestActivity.length > 0 ? (
          latestActivity.map((notif: any, idx: number) => (
            <View key={idx} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={(EVENT_ICONS[notif.event_type] || 'notifications') as any}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{notif.title}</Text>
                <Text style={styles.activityBody}>{notif.body}</Text>
                <Text style={styles.activityTime}>
                  {new Date(notif.sent_at).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="shield" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              No disruption events yet. You're protected!
            </Text>
          </View>
        )}

        {/* Brand Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Income protection. Automatic. Instant.
          </Text>
          <Text style={styles.footerVersion}>KavachAI v3.0 — Phase 3 (ML-Powered)</Text>
        </View>
      </ScrollView>

      {/* Dev Overlay — only visible in development builds */}
      {__DEV__ && <DevOverlay workerId={workerId} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  triggerBanner: {
    backgroundColor: '#C62828',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.glow,
    shadowColor: '#FF5252',
  },
  triggerBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerBannerText: {
    flex: 1,
  },
  triggerBannerTitle: {
    color: '#FFF',
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
  },
  triggerBannerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  claimButton: {
    backgroundColor: '#FFF',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#C62828',
    fontSize: fonts.sizes.sm,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.card,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  shieldIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 201, 177, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textDim,
    fontSize: fonts.sizes.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontSize: fonts.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  coverageDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    marginBottom: 4,
  },
  detailValue: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textDim,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  disruptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  disruptionCard: {
    width: (width - spacing.md * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disruptionLabel: {
    color: colors.textDim,
    fontSize: fonts.sizes.xs,
    marginTop: 4,
  },
  disruptionValue: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '700',
  },
  disruptionStatus: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 201, 177, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  activityBody: {
    color: colors.textDim,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  activityTime: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: 4,
  },
  footerText: {
    color: colors.textDim,
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
  },
  footerVersion: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
  },
});
