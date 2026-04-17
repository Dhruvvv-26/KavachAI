/**
 * GPSCamera — Layer 5 Zero-Trust Liveness Lock
 *
 * Captures a geo-stamped selfie and POSTs it as multipart/form-data
 * to the claims service for liveness verification.
 *
 * Flow: GPS fix → photo capture → build metadata → POST multipart → handle response
 */
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, borderRadius, spacing } from '../lib/theme';
import { SERVICES } from '../lib/api';
import type { SensorPayload } from '../lib/sensorCapture';

// ─── Props Interface ──────────────────────────────────────────────────────────

interface GPSCameraProps {
  worker_id?: string;
  zone_code?: string;
  trigger_event_id?: string;
  sensor_payload?: SensorPayload;
  onSuccess?: (claim_id: string) => void;
  onBlocked?: (reason: string) => void;
  onDismiss?: () => void;
  // Legacy props for backward compatibility
  onCapture?: (payload: LegacyPayload) => void;
  onCancel?: () => void;
}

interface LegacyPayload {
  photo_base64: string;
  gps_lat: number;
  gps_lng: number;
  capture_timestamp_ms: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GPSCamera({
  worker_id,
  zone_code,
  trigger_event_id,
  sensor_payload,
  onSuccess,
  onBlocked,
  onDismiss,
  onCapture,
  onCancel,
}: GPSCameraProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const isMounted = useRef(true);

  // Cleanup — mark unmounted so async callbacks abort safely
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      // 1. Request Camera Permissions
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      // 2. Request Location Permissions
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      if (isMounted.current) {
        setHasLocationPermission(locationStatus.status === 'granted');
      }
    })();
  }, [cameraPermission, requestCameraPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setShowRetry(false);

    try {
      // Get GPS coordinate at moment of shutter
      const gps_at_capture = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!isMounted.current) return;

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: false,
        exif: false,
      });

      if (!photo) throw new Error('Failed to capture photo');
      if (!isMounted.current) return;

      // Compress and resize
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!isMounted.current) return;

      const capturedAt = new Date().toISOString();
      const gpsData = {
        latitude: gps_at_capture.coords.latitude,
        longitude: gps_at_capture.coords.longitude,
        accuracy: gps_at_capture.coords.accuracy || 0,
      };

      // ── If trigger_event_id provided, use multipart upload to claims service ──
      if (trigger_event_id && worker_id) {
        const metadata = {
          worker_id,
          zone_code: zone_code || 'unknown',
          trigger_event_id,
          captured_at: capturedAt,
          gps_at_capture: gpsData,
          sensor_payload: sensor_payload || null,
        };

        // Build FormData for multipart/form-data upload
        const formData = new FormData();

        // Append photo file
        formData.append('photo', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `liveness_${worker_id}_${Date.now()}.jpg`,
        } as any);

        // Append metadata as JSON string
        formData.append('metadata', JSON.stringify(metadata));

        try {
          const response = await fetch(
            `${SERVICES.claims}/api/v1/claims/verify-liveness`,
            {
              method: 'POST',
              body: formData,
              headers: {
                'bypass-tunnel-reminder': 'true',
                // Note: Do NOT set Content-Type for FormData — browser/RN sets boundary automatically
              },
            }
          );

          if (!isMounted.current) return;

          if (response.ok) {
            const result = await response.json();
            setSuccessMessage('✓ Verification Successful');
            if (onSuccess) {
              onSuccess(result.claim_id || result.id || 'verified');
            }
          } else if (response.status === 403) {
            const result = await response.json();
            const reason = result.detail || result.reason || 'Verification failed';
            setError(`Verification Failed: ${reason}`);
            if (onBlocked) {
              onBlocked(reason);
            }
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (networkErr: any) {
          if (!isMounted.current) return;
          // Network error — show retry button, do NOT auto-retry
          setError('Network error. Check your connection.');
          setShowRetry(true);
          console.error('[GPSCamera] Upload error:', networkErr);
        }
      } else {
        // ── Legacy flow: return base64 payload to parent ──
        if (manipResult.base64 && onCapture) {
          onCapture({
            photo_base64: manipResult.base64,
            gps_lat: gpsData.latitude,
            gps_lng: gpsData.longitude,
            capture_timestamp_ms: Date.now(),
          });
        }
      }
    } catch (err: any) {
      console.error('[GPSCamera] Capture error:', err);
      if (isMounted.current) {
        setError('Failed to capture. Please try again.');
        setIsProcessing(false);
      }
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    else if (onCancel) onCancel();
  };

  // ── Loading state ──
  if (!cameraPermission || hasLocationPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>Requesting permissions...</Text>
      </View>
    );
  }

  // ── Permission denied ──
  if (!cameraPermission.granted || hasLocationPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={48} color={colors.error} />
        <Text style={styles.errorText}>
          Camera and Location permissions are required for Liveness Verification.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleDismiss}>
          <Text style={styles.cancelBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Success state ──
  if (successMessage) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={[styles.statusText, { color: colors.success, fontSize: 20, fontWeight: '700' }]}>
          {successMessage}
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleDismiss}>
          <Text style={styles.cancelBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera view ──
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="front"
        ref={cameraRef}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
              <Text style={styles.badgeText}> Biometric Lock Active</Text>
            </View>
          </View>

          <View style={styles.frameContainer}>
            <View style={styles.faceFrame} />
            <Text style={styles.instructionText}>
              Proof of Liveness: Please show your face clearly in the frame
            </Text>
          </View>

          {/* Error display */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.controls}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.processingText}>Verifying Location & Liveness...</Text>
              </View>
            ) : showRetry ? (
              <TouchableOpacity style={styles.retryButton} onPress={handleCapture}>
                <Text style={styles.retryButtonText}>Retry Upload</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  statusText: {
    color: colors.text,
    marginTop: spacing.md,
    fontSize: fonts.sizes.md,
  },
  errorText: {
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontSize: fonts.sizes.lg,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    marginTop: spacing.md,
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: fonts.sizes.md,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 201, 177, 0.3)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
  frameContainer: {
    alignItems: 'center',
  },
  faceFrame: {
    width: 250,
    height: 350,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 150,
    marginBottom: spacing.lg,
  },
  instructionText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: fonts.sizes.md,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorBannerText: {
    color: '#FCA5A5',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'center',
    height: 100,
    justifyContent: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    color: '#FFF',
    marginTop: spacing.sm,
    fontSize: fonts.sizes.sm,
  },
  retryButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  retryButtonText: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
  },
});
