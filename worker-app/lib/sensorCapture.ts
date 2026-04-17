/**
 * KavachAI Worker App — Sensor Capture SDK (Phase 3 SOAR)
 *
 * Provides:
 * - Full SensorPayload for fraud scoring (7-layer anti-spoofing)
 * - Background GPS ping job (5-minute interval, 30-ping circular buffer)
 * - Accelerometer RMS over rolling 10-second windows at 10Hz
 * - Gyroscope heading change detection
 * - Mock location detection
 * - Network type capture
 *
 * Data is POST'd to Claims Service /api/v1/claims/sensor_data/{rider_id}
 */
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendSensorPing, SERVICES, WORKER_ID } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SensorPayload {
  // GPS Layer 1
  gps: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    gps_activated_at: string;
    first_fix_at: string;
    ping_history: Array<{ lat: number; lon: number; ts: string; accuracy: number }>;
  };

  // Accelerometer Layer 2
  accelerometer: {
    rms_10s: number;
    samples_count: number;
    last_magnitude: number;
    is_moving: boolean;
  };

  // Gyroscope Layer 2
  gyroscope: {
    yaw_rate: number;
    heading_changes_5m: number;
    is_navigating: boolean;
  };

  // Network Layer 3
  network: {
    connection_type: string;
    carrier: string | null;
  };

  // Device integrity
  device: {
    mock_location_enabled: boolean;
    platform: string;
    session_start: string;
  };

  // Metadata
  worker_id: string;
  zone_code: string;
  captured_at: string;
}

// ─── Internal State ───────────────────────────────────────────────────────────

const SESSION_START = new Date().toISOString();
let gpsActivatedAt: string = '';
let firstFixAt: string = '';

// Circular buffer for last 5 pings
const pingHistory: Array<{ lat: number; lon: number; ts: string; accuracy: number }> = [];
const MAX_PING_HISTORY = 5;

// Accelerometer rolling buffer (10Hz × 10 seconds = 100 samples)
const accelBuffer: number[] = [];
const MAX_ACCEL_SAMPLES = 100;
let lastAccelMagnitude = 0;

// Gyroscope state
let currentYawRate = 0;
const headingHistory: Array<{ heading: number; ts: number }> = [];
let headingChanges5m = 0;

// Background ping job
let backgroundPingInterval: ReturnType<typeof setInterval> | null = null;
const BG_PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes = 300000ms
const BG_PING_STORAGE_KEY = 'kavachai_ping_history';
const MAX_BG_PINGS = 30;

// Sensor subscriptions
let accelSubscription: any = null;
let gyroSubscription: any = null;
let locationWatcher: Location.LocationSubscription | null = null;

// ─── Sensor Management ────────────────────────────────────────────────────────

/**
 * Start all sensor listeners (accelerometer, gyroscope, GPS watcher).
 * Call this once on app start after permissions are granted.
 */
export function startSensorListeners(): void {
  // ── Accelerometer at 10Hz ──
  try {
    Accelerometer.setUpdateInterval(100); // 10Hz = 100ms
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      lastAccelMagnitude = magnitude;
      accelBuffer.push(magnitude);
      if (accelBuffer.length > MAX_ACCEL_SAMPLES) {
        accelBuffer.shift();
      }
    });
    console.log('[SensorSDK] Accelerometer started at 10Hz');
  } catch (e) {
    console.error('[SensorSDK] Accelerometer start error:', e);
  }

  // ── Gyroscope at 10Hz ──
  try {
    Gyroscope.setUpdateInterval(100);
    gyroSubscription = Gyroscope.addListener(({ z }) => {
      currentYawRate = Math.abs(z) * (180 / Math.PI); // Convert rad/s to deg/s
    });
    console.log('[SensorSDK] Gyroscope started at 10Hz');
  } catch (e) {
    console.error('[SensorSDK] Gyroscope start error:', e);
  }

  // ── GPS Watcher ──
  startGPSWatcher();
}

/**
 * Stop all sensor listeners and clean up.
 */
export function stopSensorListeners(): void {
  if (accelSubscription) {
    accelSubscription.remove();
    accelSubscription = null;
  }
  if (gyroSubscription) {
    gyroSubscription.remove();
    gyroSubscription = null;
  }
  if (locationWatcher) {
    locationWatcher.remove();
    locationWatcher = null;
  }
  console.log('[SensorSDK] All sensor listeners stopped');
}

/**
 * Start GPS watcher with BestForNavigation accuracy.
 * Updates ping history circular buffer and tracks heading changes.
 */
async function startGPSWatcher(): Promise<void> {
  try {
    gpsActivatedAt = new Date().toISOString();

    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (location) => {
        if (!firstFixAt) {
          firstFixAt = new Date().toISOString();
        }

        const ping = {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          ts: new Date(location.timestamp).toISOString(),
          accuracy: location.coords.accuracy || 0,
        };

        pingHistory.push(ping);
        if (pingHistory.length > MAX_PING_HISTORY) {
          pingHistory.shift();
        }

        // Track heading changes for gyroscope layer
        const heading = location.coords.heading;
        if (heading !== null && heading >= 0) {
          const now = Date.now();
          headingHistory.push({ heading, ts: now });

          // Purge entries older than 5 minutes
          const fiveMinAgo = now - 5 * 60 * 1000;
          while (headingHistory.length > 0 && headingHistory[0].ts < fiveMinAgo) {
            headingHistory.shift();
          }

          // Count heading changes > 15°
          let changes = 0;
          for (let i = 1; i < headingHistory.length; i++) {
            const diff = Math.abs(headingHistory[i].heading - headingHistory[i - 1].heading);
            const normalizedDiff = diff > 180 ? 360 - diff : diff;
            if (normalizedDiff > 15) {
              changes++;
            }
          }
          headingChanges5m = changes;
        }
      }
    );
    console.log('[SensorSDK] GPS watcher started (BestForNavigation)');
  } catch (e) {
    console.error('[SensorSDK] GPS watcher error:', e);
  }
}

// ─── Mock Location Detection ──────────────────────────────────────────────────

async function detectMockLocation(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // On Android, check if GPS is available — if requested but unavailable, suspect mock
      const providerStatus = await Location.getProviderStatusAsync();
      if (!providerStatus.gpsAvailable) {
        return true; // GPS not available while location is being reported = potential mock
      }
      // Also flag if not a real device (emulator)
      return !Device.isDevice;
    } else {
      // iOS: check horizontal accuracy — negative indicates mock/simulated
      if (pingHistory.length > 0) {
        const lastPing = pingHistory[pingHistory.length - 1];
        if (lastPing.accuracy < 0) return true;
      }
      return !Device.isDevice;
    }
  } catch {
    return !Device.isDevice;
  }
}

// ─── Compute RMS ──────────────────────────────────────────────────────────────

function computeRMS(): number {
  if (accelBuffer.length === 0) return 0;
  const sumOfSquares = accelBuffer.reduce((sum, val) => sum + val * val, 0);
  const meanOfSquares = sumOfSquares / accelBuffer.length;
  return parseFloat(Math.sqrt(meanOfSquares).toFixed(3));
}

// ─── Build Complete Payload ───────────────────────────────────────────────────

/**
 * Capture a complete sensor payload for claim verification.
 * Aggregates all current sensor state into the SensorPayload structure.
 */
export async function captureSensorPayload(
  workerId: string,
  zoneCode: string
): Promise<SensorPayload> {
  const now = new Date().toISOString();
  const mockDetected = await detectMockLocation();
  const rms = computeRMS();
  const lastPing = pingHistory.length > 0 ? pingHistory[pingHistory.length - 1] : null;

  const payload: SensorPayload = {
    gps: {
      latitude: lastPing?.lat ?? 0,
      longitude: lastPing?.lon ?? 0,
      accuracy: lastPing?.accuracy ?? 0,
      altitude: null, // Expo Location doesn't reliably provide altitude in all cases
      speed: null,
      heading: headingHistory.length > 0 ? headingHistory[headingHistory.length - 1].heading : null,
      gps_activated_at: gpsActivatedAt || now,
      first_fix_at: firstFixAt || now,
      ping_history: [...pingHistory],
    },

    accelerometer: {
      rms_10s: rms,
      samples_count: accelBuffer.length,
      last_magnitude: parseFloat(lastAccelMagnitude.toFixed(3)),
      is_moving: rms > 0.5,
    },

    gyroscope: {
      yaw_rate: parseFloat(currentYawRate.toFixed(4)),
      heading_changes_5m: headingChanges5m,
      is_navigating: headingChanges5m > 2,
    },

    network: {
      connection_type: 'unknown', // Would use NetInfo if available in package.json
      carrier: null,
    },

    device: {
      mock_location_enabled: mockDetected,
      platform: Platform.OS as 'ios' | 'android',
      session_start: SESSION_START,
    },

    worker_id: workerId,
    zone_code: zoneCode,
    captured_at: now,
  };

  return payload;
}

/**
 * Legacy function: Capture sensor data and submit to backend (30-second window).
 * Kept for backward compatibility with existing trigger flow.
 */
export async function captureSensorData(workerId: string): Promise<void> {
  console.log('[SensorSDK] Starting sensor capture for worker', workerId.substring(0, 8));

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[SensorSDK] Location permission not granted, submitting partial data');
      await sendSensorPing({
        gps_pings: [],
        accelerometer_rms: 0,
        gyroscope_yaw_rate: 0,
        is_mock_location: !Device.isDevice,
        is_developer_mode: !Device.isDevice,
        gps_cold_start_ms: 30000,
        ip_address: null,
        ip_geo_lat: null,
        ip_geo_lng: null,
      });
      return;
    }

    // Build a payload from current sensor state
    const sensorPayload = await captureSensorPayload(workerId, 'unknown');

    // Submit to Claims Service in legacy format
    const legacyPayload = {
      gps_pings: sensorPayload.gps.ping_history.map(p => ({
        lat: p.lat,
        lng: p.lon,
        accuracy_m: p.accuracy,
        timestamp: p.ts,
      })),
      accelerometer_rms: sensorPayload.accelerometer.rms_10s,
      gyroscope_yaw_rate: sensorPayload.gyroscope.yaw_rate,
      is_mock_location: sensorPayload.device.mock_location_enabled,
      is_developer_mode: !Device.isDevice,
      gps_cold_start_ms: 0,
      ip_address: null,
      ip_geo_lat: null,
      ip_geo_lng: null,
    };

    await sendSensorPing(legacyPayload);
    console.log('[SensorSDK] Sensor data submitted successfully');
  } catch (error) {
    console.error('[SensorSDK] Error during sensor capture:', error);
  }
}

// ─── Background Ping Job ──────────────────────────────────────────────────────

/**
 * Start background GPS ping job.
 * Sends a GPS ping every 5 minutes (300,000ms) for Layer 4 T-30 residency check.
 * Stores pings locally in AsyncStorage as a circular buffer of last 30 pings.
 */
export function startBackgroundPingJob(workerId: string, zoneCode: string): void {
  if (backgroundPingInterval) {
    console.log('[SensorSDK] Background ping job already running');
    return;
  }

  console.log('[SensorSDK] Starting background ping job (every 5 min)');

  const doPing = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const ping = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        ts: new Date(location.timestamp).toISOString(),
        worker_id: workerId,
        zone_code: zoneCode,
      };

      // Store in AsyncStorage circular buffer
      try {
        const raw = await AsyncStorage.getItem(BG_PING_STORAGE_KEY);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        existing.push(ping);

        // Keep only last 30 pings
        while (existing.length > MAX_BG_PINGS) {
          existing.shift();
        }

        await AsyncStorage.setItem(BG_PING_STORAGE_KEY, JSON.stringify(existing));
      } catch (storageErr) {
        console.error('[SensorSDK] AsyncStorage ping save error:', storageErr);
      }

      // Send to backend
      try {
        const url = `${SERVICES.worker}/api/v1/riders/${workerId}/gps-ping`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true',
          },
          body: JSON.stringify({
            latitude: ping.lat,
            longitude: ping.lon,
            accuracy: ping.accuracy,
          }),
        });
        console.log('[SensorSDK] Background ping sent:', ping.lat.toFixed(4), ping.lon.toFixed(4));
      } catch (apiErr) {
        console.error('[SensorSDK] Background ping API error:', apiErr);
      }
    } catch (e) {
      console.error('[SensorSDK] Background ping GPS error:', e);
    }
  };

  // Send first ping immediately, then every 5 minutes
  doPing();
  backgroundPingInterval = setInterval(doPing, BG_PING_INTERVAL_MS);
}

/**
 * Stop the background GPS ping job.
 */
export function stopBackgroundPingJob(): void {
  if (backgroundPingInterval) {
    clearInterval(backgroundPingInterval);
    backgroundPingInterval = null;
    console.log('[SensorSDK] Background ping job stopped');
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
