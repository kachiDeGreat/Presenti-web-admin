// Core data types for Enterprise Attendance Platform

export type VerificationMethod = 'WIFI_BSSID' | 'GEO_FALLBACK';
export type AttendanceStatus = 'ON_TIME' | 'LATE';

export interface BeaconConfig {
  targetBssid: string; // MAC address, e.g. "0c:61:f9:65:8f:07"
  ssidHint: string;    // Human label, e.g. "Office-Main-5G"
}

export interface GeoFallback {
  latitude: number;
  longitude: number;
  radiusMeters: number; // e.g. 40
  isConfigured?: boolean;
}

export interface PolicySettings {
  serviceDays: number[]; // 0 for Sunday, 3 for Wednesday, etc.
  arrivalCutoff: string; // e.g. "07:30"
  lateTolerance?: string; // e.g. "07:45"
  syncCutoff: string;    // e.g. "12:00"
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
