// Core data types for Enterprise Attendance Platform

export type VerificationMethod = 'WIFI_BSSID' | 'GEO_FALLBACK';
export type AttendanceStatus = 'ON_TIME' | 'LATE';

export interface BeaconConfig {
  targetBssid: string; // MAC address, e.g. "0c:61:f9:65:8f:07" or "" if GEOFENCE_ONLY
  ssidHint: string;    // Human label, e.g. "Office-Main-5G" or "Office Geofence Zone"
  verificationMode?: 'HYBRID' | 'GEOFENCE_ONLY';
}

export interface GeoFallback {
  latitude: number;
  longitude: number;
  radiusMeters: number; // e.g. 40
  isConfigured?: boolean;
  isCalibrated?: boolean;
}

export interface DaySchedule {
  arrivalCutoff?: string; // e.g. "07:00"
  lateTolerance?: string; // e.g. "07:30"
  allowLateSignIn?: boolean; // If true, workers can sign in after close time marked LATE
  enableSignOut?: boolean; // If true, workers are required/allowed to sign out
  signOutTime?: string; // e.g. "17:00"
}

export interface PolicySettings {
  serviceDays: number[]; // 0 for Sunday, 3 for Wednesday, etc.
  scheduleMode?: 'UNIFIED' | 'PER_DAY'; // 'UNIFIED' = same for all active days; 'PER_DAY' = custom per day
  arrivalCutoff: string; // e.g. "07:00" (Default / Unified Sign-In Window Open Time)
  lateTolerance?: string; // e.g. "07:30" (Default / Unified Sign-In Window Close Time)
  allowLateSignIn?: boolean; // Default / Unified
  enableSignOut?: boolean; // Default / Unified
  signOutTime?: string; // Default / Unified
  daySchedules?: Record<number | string, DaySchedule>; // Custom schedules keyed by day number 0..6
  syncCutoff?: string; // Deprecated/optional
}

export interface CalibrationSessionData {
  status: 'AWAITING_SCAN' | 'CONNECTED' | 'DISCONNECTED' | 'CANCELLED' | 'COMPLETED';
  connectedAt?: string;
  completedAt?: string;
  disconnectedAt?: string;
  platform?: string;
  mode?: 'HYBRID' | 'GEOFENCE_ONLY';
}

export interface Church {
  id: string;
  churchName: string;
  branchName: string;
  churchCode: string;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
  adminUids: string[];
  departments: string[];
  beaconConfig: BeaconConfig;
  geoFallback: GeoFallback;
  policySettings: PolicySettings;
  calibrationSession?: CalibrationSessionData;
  isCalibrated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChurchMember {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  photoURL?: string;
  department: string;
  boundDeviceId: string;
  registeredAt: string;
  faceEmbedding?: number[];
  facePhotoURL?: string;
  isFaceEnrolled?: boolean;
  faceEnrolledAt?: string;
}

export type Organization = Church;
export type OrganizationMember = ChurchMember;

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  department: string;
  serviceDate: string; // YYYY-MM-DD
  punchedAt: string;   // ISO string or timestamp
  syncedAt: string;    // ISO string or timestamp
  verificationMethod: VerificationMethod;
  status: AttendanceStatus;
  signedOutAt?: string; // ISO string when signed out
  signOutDisplayTime?: string; // e.g. "05:15:30 PM"
  faceVerification?: {
    verified: boolean;
    confidence: number;
    method: 'IN_APP_FACE_AI';
    failureReason?: string;
  };
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  churchId?: string | null;
}
