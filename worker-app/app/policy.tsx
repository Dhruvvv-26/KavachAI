/**
 * KavachAI Worker App — My Policy Screen
 *
 * Displays:
 * - Coverage tier details (Basic/Standard/Premium)
 * - Weekly premium breakdown with SHAP-style factors (LIVE from ML service)
 * - Policy pause/cancel options
 * - Renew button
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../lib/theme';
import { getPremiumBreakdown, calculatePremium } from '../lib/api';

const TIER_DETAILS: Record<string, any> = {
  basic: {
    name: 'Basic',
    color: '#4CAF50',
    maxPayout: 300,
    triggers: ['AQI', 'Heavy Rain'],
    weeklyPremium: 35,
  },
  standard: {
    name: 'Standard',
    color: colors.primary,
    maxPayout: 600,
    triggers: ['AQI', 'Heavy Rain', 'Extreme Heat', 'Cyclone', 'Curfew'],
    weeklyPremium: 67.60,
  },
  premium: {
    name: 'Premium',
    color: '#FFD700',
    maxPayout: 1000,
    triggers: ['All 5 Triggers', '3× daily coverage', 'Priority claims'],
    weeklyPremium: 125,
  },
};

// ─── SHAP Feature Explanations ────────────────────────────────────────────────

const shapExplanations: Record<string, string> = {
  base_rate: "Base weekly premium before risk adjustments",
  zone_aqi_risk: "Delhi has 60+ disruption days per year",
  city_zone: "Delhi has 60+ disruption days per year",
  seasonality_month: "This month has historically higher disruption probability",
  month_seasonality: "This month has historically higher disruption probability",
  vehicle_type_bicycle: "Bicycle riders face full income loss in rain and AQI events",
  vehicle_type: "Bicycle riders face full income loss in rain and AQI events",
  disruption_history_90d: "Recent trigger frequency in this zone",
  declared_daily_trips: "Higher trip volume = more income at risk per event",
  avg_daily_earnings: "Daily earnings determine maximum possible loss",
  historical_rain_events: "This zone had elevated rain events in the past 12 months",
  historical_aqi_events: "This zone had elevated AQI events in the past 12 months",
  platform_blinkit_multiplier: "Platform-specific risk factor",
  coverage_tier_standard: "Standard tier includes all 5 disruption types",
  coverage_tier: "Standard tier includes all 5 disruption types",
  monthly_work_days: "More work days = higher exposure risk",
  new_rider_discount: "New rider introductory discount applied",
  zone_clustering_adjustment: "Zone clustering reduces overall portfolio risk",
};

export default function PolicyScreen() {
  const currentTier = 'standard';
  const tier = TIER_DETAILS[currentTier];

  // SHAP breakdown state
  const [shapBreakdown, setShapBreakdown] = useState<Record<string, number> | null>(null);
  const [shapPremium, setShapPremium] = useState<number | null>(null);
  const [shapLoading, setShapLoading] = useState(true);
  const [shapLive, setShapLive] = useState(false);
  const [showWhyExpanded, setShowWhyExpanded] = useState(false);

  // Fetch SHAP breakdown on mount
  useEffect(() => {
    async function loadShapBreakdown() {
      setShapLoading(true);
      try {
        const result = await getPremiumBreakdown();
        if (result && (result as any).shap_breakdown) {
          setShapBreakdown((result as any).shap_breakdown);
          setShapPremium((result as any).recommended_premium);
          setShapLive(true);
        } else {
          // Fallback: try direct calculatePremium
          const directResult = await calculatePremium({
            city: "delhi_ncr",
            vehicle_type: "bicycle",
            coverage_tier: "standard",
            month: new Date().getMonth() + 1,
            historical_aqi_events_12m: 45,
            historical_rain_events_12m: 28,
            disruption_history_90d: 15,
            declared_daily_trips: 30,
            avg_daily_earnings: 1100.0,
            monthly_work_days: 22,
          });
          if (directResult && directResult.shap_breakdown) {
            setShapBreakdown(directResult.shap_breakdown);
            setShapPremium(directResult.recommended_premium);
            setShapLive(true);
          }
        }
      } catch (e) {
        console.error('[PolicyScreen] SHAP fetch error:', e);
      } finally {
        setShapLoading(false);
      }
    }
    loadShapBreakdown();
  }, []);

  const handlePause = () => {
    Alert.alert(
      'Pause Policy',
      'Your coverage will be paused. You can resume anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pause', style: 'destructive' },
      ],
    );
  };

  const handleRenew = () => {
    Alert.alert(
      'Renew Policy',
      `Renew your ${tier.name} tier policy for ₹${tier.weeklyPremium}/week?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew via UPI', style: 'default' },
      ],
    );
  };

  // Sort SHAP by absolute value for display
  const sortedShap = shapBreakdown
    ? Object.entries(shapBreakdown).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    : [];

  // Top 3 contributing factors for "Why this price?"
  const top3 = sortedShap.slice(0, 3);

  // Calculate max bar width
  const maxContribution = sortedShap.length > 0
    ? Math.max(...sortedShap.map(([, v]) => Math.abs(v)))
    : 1;

  // Total premium
  const totalPremium = shapPremium || (shapBreakdown
    ? Object.values(shapBreakdown).reduce((sum, v) => sum + v, 0)
    : tier.weeklyPremium);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Policy Card */}
      <View style={[styles.policyCard, { borderTopColor: tier.color }]}>
        <View style={styles.policyHeader}>
          <View style={[styles.tierBadge, { backgroundColor: `${tier.color}20` }]}>
            <Ionicons name="shield-checkmark" size={32} color={tier.color} />
          </View>
          <View style={styles.policyInfo}>
            <Text style={styles.tierName}>{tier.name} Tier</Text>
            <Text style={styles.policyStatus}>Active until Apr 7, 2026</Text>
          </View>
          <View style={[styles.activeBadge, { borderColor: colors.success }]}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>ACTIVE</Text>
          </View>
        </View>

        {/* Coverage Details */}
        <View style={styles.coverageGrid}>
          <View style={styles.coverageItem}>
            <Text style={styles.coverageLabel}>Max Payout</Text>
            <Text style={styles.coverageValue}>₹{tier.maxPayout}/event</Text>
          </View>
          <View style={styles.coverageItem}>
            <Text style={styles.coverageLabel}>Weekly Premium</Text>
            <Text style={styles.coverageValue}>₹{totalPremium.toFixed(2)}</Text>
          </View>
          <View style={styles.coverageItem}>
            <Text style={styles.coverageLabel}>Zone</Text>
            <Text style={styles.coverageValue}>Delhi Rohini</Text>
          </View>
          <View style={styles.coverageItem}>
            <Text style={styles.coverageLabel}>Payout Mode</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <View style={{
                backgroundColor: 'rgba(0, 201, 177, 0.15)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 12,
              }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                  LUMP SUM
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Covered Triggers */}
        <View style={styles.triggersSection}>
          <Text style={styles.sectionTitle}>Covered Triggers</Text>
          <View style={styles.triggerList}>
            {tier.triggers.map((trigger: string, idx: number) => (
              <View key={idx} style={styles.triggerItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.triggerText}>{trigger}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Force Majeure Exclusions */}
        <View style={[styles.triggersSection, { marginTop: spacing.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Force Majeure Exclusions</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
            Events excluded from parametric coverage per IRDAI guidelines:
          </Text>
          <View style={styles.triggerList}>
            {[
              { code: 'ACT_OF_WAR', label: 'Act of War' },
              { code: 'PANDEMIC_DECLARED', label: 'WHO Pandemic Declaration' },
              { code: 'TERRORISM', label: 'Terrorist Incident' },
              { code: 'NUCLEAR_EVENT', label: 'Nuclear / Radiological Event' },
              { code: 'GOV_LOCKDOWN_72H+', label: 'Extended Lockdown (>72h)' },
            ].map((excl, idx) => (
              <View key={idx} style={styles.triggerItem}>
                <Ionicons name="close-circle" size={16} color={colors.error} />
                <Text style={styles.triggerText}>{excl.label}</Text>
              </View>
            ))}
          </View>
          <View style={{
            backgroundColor: 'rgba(255, 193, 7, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255, 193, 7, 0.2)',
            borderRadius: 8,
            padding: 10,
            marginTop: spacing.sm,
          }}>
            <Text style={{ color: colors.textDim, fontSize: 11, lineHeight: 16 }}>
              ℹ️ Short-term curfews (≤72h) and weather disruptions remain covered.
              Exclusions only apply for officially designated events.
            </Text>
          </View>
        </View>
      </View>

      {/* SHAP Premium Breakdown */}
      <View style={styles.breakdownCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>Premium Breakdown</Text>
          {shapLive && (
            <View style={{
              backgroundColor: 'rgba(0, 201, 177, 0.15)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
            }}>
              <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '700' }}>LIVE ML</Text>
            </View>
          )}
        </View>
        <Text style={styles.breakdownSubtitle}>
          {shapLive
            ? 'XGBoost + LightGBM ensemble — per-feature contribution'
            : 'Rule-based calculation with SHAP-style transparency'}
        </Text>

        {shapLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : shapBreakdown ? (
          <View style={styles.breakdownRows}>
            {/* SHAP horizontal bar chart */}
            {sortedShap.map(([feature, value], idx) => {
              const isPositive = value >= 0;
              const barWidth = Math.max((Math.abs(value) / maxContribution) * 100, 5);
              const label = shapExplanations[feature]
                ? feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <View key={feature} style={styles.shapRow}>
                  <Text style={styles.shapLabel} numberOfLines={1}>{label}</Text>
                  <View style={styles.shapBarContainer}>
                    <View
                      style={[
                        styles.shapBar,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: isPositive
                            ? 'rgba(0, 201, 177, 0.6)'
                            : 'rgba(239, 68, 68, 0.6)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[
                    styles.shapValue,
                    { color: isPositive ? colors.primary : colors.error }
                  ]}>
                    {isPositive ? '+' : ''}₹{value.toFixed(2)}
                  </Text>
                </View>
              );
            })}

            {/* Total */}
            <View style={styles.breakdownTotal}>
              <Text style={styles.totalLabel}>Your weekly premium</Text>
              <Text style={styles.totalValue}>₹{totalPremium.toFixed(2)}</Text>
            </View>
          </View>
        ) : (
          /* Fallback hardcoded breakdown if API unavailable */
          <View style={styles.breakdownRows}>
            {[
              { label: 'Base Rate (Delhi NCR)', value: '₹25.00', factor: '1.0×' },
              { label: 'Zone Risk (Rohini)', value: '₹40.00', factor: '2.6×', highlight: true },
              { label: 'Seasonal Adjustment', value: '+₹5.10', factor: '1.2×' },
              { label: 'Platform (Blinkit)', value: '+₹2.50', factor: '1.1×' },
              { label: 'Tier Uplift', value: '+₹0.00', factor: '1.0×' },
            ].map((row, idx) => (
              <View key={idx} style={[styles.breakdownRow,
                row.highlight && styles.breakdownRowHighlight]}>
                <View style={styles.breakdownLeft}>
                  <Text style={styles.breakdownLabel}>{row.label}</Text>
                  <Text style={styles.breakdownFactor}>{row.factor}</Text>
                </View>
                <Text style={[styles.breakdownValue,
                  row.highlight && { color: colors.primary }]}>
                  {row.value}
                </Text>
              </View>
            ))}
            <View style={styles.breakdownTotal}>
              <Text style={styles.totalLabel}>Weekly Premium</Text>
              <Text style={styles.totalValue}>₹67.60</Text>
            </View>
          </View>
        )}

        {/* "Why this price?" expandable section */}
        {shapBreakdown && top3.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <TouchableOpacity
              onPress={() => setShowWhyExpanded(!showWhyExpanded)}
              style={styles.whyButton}
            >
              <Text style={styles.whyButtonText}>
                {showWhyExpanded ? '▼ Why this price?' : '▶ Why this price?'}
              </Text>
            </TouchableOpacity>

            {showWhyExpanded && (
              <View style={styles.whyContent}>
                {top3.map(([feature, value], idx) => (
                  <View key={feature} style={styles.whyRow}>
                    <Text style={styles.whyNumber}>{idx + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.whyFeature}>
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {' '}({value >= 0 ? '+' : ''}₹{value.toFixed(2)})
                      </Text>
                      <Text style={styles.whyExplanation}>
                        {shapExplanations[feature] || 'Contributing factor to your premium calculation'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tier Comparison */}
      <View style={styles.tierCompare}>
        <Text style={styles.sectionTitle}>All Tiers</Text>
        {Object.entries(TIER_DETAILS).map(([key, t]) => (
          <View key={key} style={[styles.tierRow,
            key === currentTier && styles.tierRowActive]}>
            <View style={[styles.tierDot, { backgroundColor: t.color }]} />
            <View style={styles.tierRowInfo}>
              <Text style={styles.tierRowName}>{t.name}</Text>
              <Text style={styles.tierRowDetail}>
                ₹{t.weeklyPremium}/wk · Max ₹{t.maxPayout}/event
              </Text>
            </View>
            {key === currentTier && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>CURRENT</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.renewButton}
          onPress={handleRenew} activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.renewButtonText}>Renew Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pauseButton}
          onPress={handlePause} activeOpacity={0.8}
        >
          <Ionicons name="pause-circle" size={20} color={colors.warning} />
          <Text style={styles.pauseButtonText}>Pause Coverage</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  policyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  policyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tierBadge: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  policyInfo: { flex: 1 },
  tierName: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: '700' },
  policyStatus: { color: colors.textDim, fontSize: fonts.sizes.sm, marginTop: 2 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  activeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
  },
  activeText: {
    color: colors.success, fontSize: fonts.sizes.xs, fontWeight: '700', letterSpacing: 1,
  },
  coverageGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  coverageItem: {
    width: '47%', backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm, padding: spacing.md,
  },
  coverageLabel: { color: colors.textMuted, fontSize: fonts.sizes.xs },
  coverageValue: {
    color: colors.text, fontSize: fonts.sizes.md, fontWeight: '700', marginTop: 4,
  },
  triggersSection: { marginTop: spacing.lg },
  sectionTitle: {
    color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '700',
    marginBottom: spacing.sm,
  },
  triggerList: { gap: spacing.xs },
  triggerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  triggerText: { color: colors.textDim, fontSize: fonts.sizes.md },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownSubtitle: {
    color: colors.textMuted, fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
  },
  breakdownRows: { gap: spacing.xs },
  // SHAP bar chart styles
  shapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shapLabel: {
    color: colors.textDim,
    fontSize: 11,
    width: 100,
    marginRight: 8,
  },
  shapBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  shapBar: {
    height: '100%',
    borderRadius: 4,
  },
  shapValue: {
    width: 60,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Legacy breakdown styles
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  breakdownRowHighlight: {
    backgroundColor: 'rgba(0, 201, 177, 0.05)',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  breakdownLeft: { flex: 1 },
  breakdownLabel: { color: colors.textDim, fontSize: fonts.sizes.sm },
  breakdownFactor: { color: colors.textMuted, fontSize: fonts.sizes.xs, marginTop: 1 },
  breakdownValue: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: '600' },
  breakdownTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing.md, marginTop: spacing.sm,
  },
  totalLabel: { color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '700' },
  totalValue: {
    color: colors.primary, fontSize: fonts.sizes.xl, fontWeight: '700',
  },
  // "Why this price?" section
  whyButton: {
    paddingVertical: 8,
  },
  whyButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  whyContent: {
    backgroundColor: 'rgba(0, 201, 177, 0.05)',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  whyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whyNumber: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    width: 20,
  },
  whyFeature: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  whyExplanation: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tierCompare: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tierRowActive: {
    backgroundColor: 'rgba(0, 201, 177, 0.05)',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  tierDot: { width: 12, height: 12, borderRadius: 6 },
  tierRowInfo: { flex: 1 },
  tierRowName: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: '600' },
  tierRowDetail: { color: colors.textMuted, fontSize: fonts.sizes.xs, marginTop: 2 },
  currentBadge: {
    backgroundColor: 'rgba(0, 201, 177, 0.15)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  currentBadgeText: {
    color: colors.primary, fontSize: fonts.sizes.xs, fontWeight: '700',
  },
  actions: { gap: spacing.sm },
  renewButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  renewButtonText: { color: '#FFF', fontSize: fonts.sizes.lg, fontWeight: '700' },
  pauseButton: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pauseButtonText: { color: colors.warning, fontSize: fonts.sizes.md, fontWeight: '600' },
});
