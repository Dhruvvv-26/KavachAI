/**
 * KavachAI Worker App — Centralized Permission Manager
 *
 * Requests all required permissions in the correct order:
 * 1. Location (foreground first, then background)
 * 2. Camera
 * 3. Motion/sensors (iOS only)
 *
 * Returns a structured PermissionStatus and caches in AsyncStorage.
 * Never throws — catches all errors, logs, and returns false for that permission.
 */
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'kavachai_permissions_v1';

export interface PermissionStatus {
  location_foreground: boolean;
  location_background: boolean;
  camera: boolean;
  motion: boolean;              // accelerometer + gyroscope
  all_critical_granted: boolean; // true only if location_foreground + camera are true
  background_granted: boolean;   // true if background location granted
}

/**
 * Request all permissions in sequence.
 * iOS requires foreground location to be granted before background can be requested.
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  const status: PermissionStatus = {
    location_foreground: false,
    location_background: false,
    camera: false,
    motion: false,
    all_critical_granted: false,
    background_granted: false,
  };

  // ── Step 1: Location Foreground ──────────────────────────────────────────
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    status.location_foreground = fgStatus === 'granted';
    console.log('[PermissionManager] Location foreground:', fgStatus);
  } catch (e) {
    console.error('[PermissionManager] Location foreground error:', e);
  }

  // ── Step 2: Location Background (only if foreground was granted) ─────────
  if (status.location_foreground) {
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      status.location_background = bgStatus === 'granted';
      status.background_granted = bgStatus === 'granted';
      console.log('[PermissionManager] Location background:', bgStatus);
    } catch (e) {
      console.error('[PermissionManager] Location background error:', e);
    }
  }

  // ── Step 3: Camera ──────────────────────────────────────────────────────
  try {
    const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
    status.camera = camStatus === 'granted';
    console.log('[PermissionManager] Camera:', camStatus);
  } catch (e) {
    console.error('[PermissionManager] Camera error:', e);
  }

  // ── Step 4: Motion / Sensors (iOS requires explicit permission) ─────────
  try {
    if (Platform.OS === 'ios') {
      const { status: accelStatus } = await Accelerometer.requestPermissionsAsync();
      status.motion = accelStatus === 'granted';
      console.log('[PermissionManager] Motion (iOS):', accelStatus);
    } else {
      // Android doesn't require runtime permission for accelerometer/gyroscope
      status.motion = true;
    }
  } catch (e) {
    console.error('[PermissionManager] Motion error:', e);
    // On Android, sensors work without explicit permission
    if (Platform.OS === 'android') {
      status.motion = true;
    }
  }

  // ── Derived flags ───────────────────────────────────────────────────────
  status.all_critical_granted = status.location_foreground && status.camera;

  // ── Persist to AsyncStorage ─────────────────────────────────────────────
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(status));
    console.log('[PermissionManager] Status cached in AsyncStorage');
  } catch (e) {
    console.error('[PermissionManager] AsyncStorage save error:', e);
  }

  console.log('[PermissionManager] Final status:', JSON.stringify(status));
  return status;
}

/**
 * Read the last cached permission status from AsyncStorage.
 * Returns null if not yet checked.
 */
export async function getCachedPermissions(): Promise<PermissionStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PermissionStatus;
  } catch {
    return null;
  }
}
