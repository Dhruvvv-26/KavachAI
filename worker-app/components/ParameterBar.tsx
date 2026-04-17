/**
 * ParameterBar.tsx
 * KavachAI Worker App — Segmented threshold progress bar
 *
 * Renders a 3-zone bar: Safe (green) / Warning (amber) / Critical (red)
 * Supports AQI, Rain, Heat, and ML confidence inputs with full null safety.
 *
 * Place at: worker-app/src/components/ParameterBar.tsx
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParameterType = "aqi" | "rain" | "heat" | "disruption" | "ml_confidence";

export interface ThresholdConfig {
  /** Value at which Warning zone begins */
  warning: number;
  /** Value at which Critical zone begins */
  critical: number;
  /** Maximum expected value (bar ceiling) */
  max: number;
  /** Display unit label e.g. "AQI", "mm", "°C", "%" */
  unit: string;
}

export interface ParameterBarProps {
  /** Display label shown above the bar */
  label: string;
  /** The live current value. Pass null/undefined while loading — bar shows skeleton. */
  currentValue: number | null | undefined;
  /** Threshold config for this parameter type */
  thresholds: ThresholdConfig;
  /** Parameter type controls icon and color semantics */
  type: ParameterType;
  /** Optional: ML confidence score (0–1) from Phase 3 SOAR payload */
  mlConfidence?: number | null;
  /** Optional: Tier label from SOAR ("Normal" | "Tier 1" | "Force Majeure") */
  mlTierLabel?: string | null;
  /** Container style override */
  style?: ViewStyle;
}

// ─── Threshold defaults per parameter type ───────────────────────────────────

export const DEFAULT_THRESHOLDS: Record<ParameterType, ThresholdConfig> = {
  aqi: { warning: 200, critical: 350, max: 500, unit: "AQI" },
  rain: { warning: 30, critical: 60, max: 100, unit: "mm" },
  heat: { warning: 38, critical: 43, max: 50, unit: "°C" },
  disruption: { warning: 0.4, critical: 0.7, max: 1.0, unit: "risk" },
  ml_confidence: { warning: 0.4, critical: 0.7, max: 1.0, unit: "%" },
};

// ─── Color palette (matches admin dashboard zinc-950/teal-400 system) ─────────

const COLORS = {
  safe: "#1D9E75",       // teal-600 — matches ML Engine Online marker
  safeLight: "#E1F5EE",
  warning: "#D97706",    // amber-600
  warningLight: "#FEF3C7",
  critical: "#DC2626",   // red-600
  criticalLight: "#FEE2E2",
  barTrack: "#27272A",   // zinc-800
  barTrackLight: "#E4E4E7",
  labelPrimary: "#F4F4F5",     // zinc-100
  labelSecondary: "#A1A1AA",   // zinc-400
  skeleton: "#3F3F46",         // zinc-700
  badge: {
    normal: { bg: "#14532D", text: "#86EFAC" },
    tier1: { bg: "#713F12", text: "#FDE68A" },
    forceMajeure: { bg: "#7F1D1D", text: "#FCA5A5" },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getZone(
  value: number,
  thresholds: ThresholdConfig
): "safe" | "warning" | "critical" {
  if (value >= thresholds.critical) return "critical";
  if (value >= thresholds.warning) return "warning";
  return "safe";
}

function clampPercent(value: number, max: number): number {
  if (!isFinite(value) || !isFinite(max) || max === 0) return 0;
  return Math.min(Math.max((value / max) * 100, 0), 100);
}

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${Math.round(value * 100)}%`;
  if (unit === "risk") return `${Math.round(value * 100)}%`;
  if (Number.isInteger(value)) return `${value} ${unit}`;
  return `${value.toFixed(1)} ${unit}`;
}

function tierBadgeStyle(label: string | null | undefined) {
  if (!label) return null;
  const normalized = label.toLowerCase();
  if (normalized.includes("force")) return COLORS.badge.forceMajeure;
  if (normalized.includes("tier")) return COLORS.badge.tier1;
  return COLORS.badge.normal;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ParameterBar: React.FC<ParameterBarProps> = ({
  label,
  currentValue,
  thresholds,
  type,
  mlConfidence,
  mlTierLabel,
  style,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const animatedConfidence = useRef(new Animated.Value(0)).current;
  const isLoading = currentValue === null || currentValue === undefined;

  // Compute derived values with full null safety
  const safeValue = isLoading ? 0 : currentValue;
  const fillPercent = clampPercent(safeValue, thresholds.max);
  const zone = isLoading ? "safe" : getZone(safeValue, thresholds);

  // Segmented zone widths (each zone occupies its proportional slice of the bar)
  const warnStart = clampPercent(thresholds.warning, thresholds.max);
  const critStart = clampPercent(thresholds.critical, thresholds.max);

  const zoneColors: Record<"safe" | "warning" | "critical", string> = {
    safe: COLORS.safe,
    warning: COLORS.warning,
    critical: COLORS.critical,
  };
  const fillColor = zoneColors[zone];

  // Animate fill on value change
  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: fillPercent,
      tension: 60,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [fillPercent]);

  // Animate ML confidence bar separately
  const confidencePercent =
    mlConfidence != null ? clampPercent(mlConfidence, 1.0) : 0;
  useEffect(() => {
    Animated.spring(animatedConfidence, {
      toValue: confidencePercent,
      tension: 60,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [confidencePercent]);

  const badge = tierBadgeStyle(mlTierLabel);

  return (
    <View style={[styles.container, style]}>
      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.headerRight}>
          {badge && mlTierLabel ? (
            <View style={[styles.tierBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.tierBadgeText, { color: badge.text }]}>
                {mlTierLabel}
              </Text>
            </View>
          ) : null}
          {!isLoading ? (
            <Text style={[styles.valueText, { color: fillColor }]}>
              {formatValue(safeValue, thresholds.unit)}
            </Text>
          ) : (
            <View style={styles.skeletonValue} />
          )}
        </View>
      </View>

      {/* ── Main segmented bar ── */}
      <View style={styles.trackOuter}>
        {/* Track background */}
        <View style={styles.track} />

        {/* Zone divider markers */}
        <View
          style={[
            styles.zoneDivider,
            { left: `${warnStart}%` as unknown as number },
          ]}
        />
        <View
          style={[
            styles.zoneDivider,
            { left: `${critStart}%` as unknown as number },
          ]}
        />

        {/* Animated fill */}
        {isLoading ? (
          <View style={styles.skeletonFill} />
        ) : (
          <Animated.View
            style={[
              styles.fill,
              {
                width: animatedWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                  extrapolate: "clamp",
                }),
                backgroundColor: fillColor,
              },
            ]}
          />
        )}
      </View>

      {/* ── Zone labels ── */}
      <View style={styles.zoneLabels}>
        <Text style={[styles.zoneLabel, { color: COLORS.safe }]}>Safe</Text>
        <Text style={[styles.zoneLabel, { color: COLORS.warning }]}>Warn</Text>
        <Text style={[styles.zoneLabel, { color: COLORS.critical }]}>Crit</Text>
      </View>

      {/* ── ML Confidence sub-bar (only shown when mlConfidence is present) ── */}
      {mlConfidence != null ? (
        <View style={styles.mlSection}>
          <Text style={styles.mlLabel}>
            ML confidence{" "}
            <Text style={{ color: fillColor }}>
              {Math.round(mlConfidence * 100)}%
            </Text>
          </Text>
          <View style={styles.mlTrack}>
            <Animated.View
              style={[
                styles.mlFill,
                {
                  width: animatedConfidence.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                    extrapolate: "clamp",
                  }),
                  backgroundColor: fillColor,
                  opacity: 0.65,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* ── Threshold legend ── */}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>
          Warn ≥ {formatValue(thresholds.warning, thresholds.unit)}
        </Text>
        <Text style={styles.legendText}>
          Crit ≥ {formatValue(thresholds.critical, thresholds.unit)}
        </Text>
        <Text style={styles.legendText}>
          Max {formatValue(thresholds.max, thresholds.unit)}
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#18181B", // zinc-900
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#3F3F46", // zinc-700
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.labelPrimary,
    letterSpacing: 0.3,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  skeletonValue: {
    width: 52,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.skeleton,
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  trackOuter: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    marginBottom: 4,
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.barTrack,
    borderRadius: 4,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  skeletonFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "30%",
    backgroundColor: COLORS.skeleton,
    borderRadius: 4,
    opacity: 0.5,
  },
  zoneDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#52525B", // zinc-600
    zIndex: 2,
  },
  zoneLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  zoneLabel: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  mlSection: {
    marginTop: 4,
    marginBottom: 6,
  },
  mlLabel: {
    fontSize: 10,
    color: COLORS.labelSecondary,
    marginBottom: 4,
  },
  mlTrack: {
    height: 3,
    backgroundColor: COLORS.barTrack,
    borderRadius: 2,
    overflow: "hidden",
  },
  mlFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  legendText: {
    fontSize: 9,
    color: COLORS.labelSecondary,
    fontVariant: ["tabular-nums"],
  },
});

export default ParameterBar;
