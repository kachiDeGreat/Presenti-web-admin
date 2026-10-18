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

export interface PolicySettings {
  serviceDays: number[]; // 0 for Sunday, 3 for Wednesday, etc.
  arrivalCutoff: string; // e.g. "07:00" (Sign-In Window Open Time)
  lateTolerance?: string; // e.g. "07:30" (Sign-In Window Close Time)
  allowLateSignIn?: boolean; // If true, workers can sign in after close time carrying a "LATE" tag
  enableSignOut?: boolean; // If true, workers are required/allowed to sign out
  signOutTime?: string; // e.g. "17:00" (Sign-out starts from this time; no close cutoff)
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
