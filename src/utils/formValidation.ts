/**
 * Comprehensive Enterprise Form Validation Suite
 * Strictly enforces regex verification across all input fields:
 * - Phone numbers (national & international E.164 formats)
 * - Email addresses (RFC 5322 standard)
 * - Organization / Church Codes (alphanumeric uppercase with hyphens)
 * - Names (Organization, Branch, Administrator Full Name, Departments)
 * - Hardware Wi-Fi MAC Address / BSSID (6 hex octets)
 * - Wi-Fi SSID
 * - Geolocation Coordinates (Latitude / Longitude)
 * - Time inputs & Attendance window sequences
 * Prevents users from inputting arbitrary or invalid "anyhow" data.
 */

export * from './timeValidation';

// ---------------------------------------------------------------------------
// 1. PHONE NUMBER REGEX & VALIDATOR
// ---------------------------------------------------------------------------
/**
 * Validates international (e.g. +234 803 123 4567, +1 (555) 234-5678)
 * and national (e.g. 08031234567, 0803 123 4567) phone formats.
 * Must match structural pattern and contain 7 to 15 digits.
 */
export const PHONE_REGEX = /^\+?[0-9]{1,4}?[-.\s]?\(?[0-9]{1,4}?\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}$/;

export const validatePhoneNumber = (
  phone: string
): { isValid: boolean; error: string | null } => {
  const trimmed = phone?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Phone number is required.' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      error: 'Phone number must have 7 to 15 digits (e.g. +234 803 123 4567).',
    };
  }
  if (!PHONE_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid phone format (e.g. +234 803 123 4567).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 2. EMAIL ADDRESS REGEX & VALIDATOR
// ---------------------------------------------------------------------------
/**
 * RFC 5322 standard email regex:
 * e.g. admin@graceconsulate.org, user.name@domain.co.uk
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const validateEmail = (
  email: string
): { isValid: boolean; error: string | null } => {
  const trimmed = email?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g. admin@domain.com).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 3. ORGANIZATION / CHURCH CODE REGEX & VALIDATOR
// ---------------------------------------------------------------------------
/**
 * Uppercase alphanumeric characters with hyphens (e.g. "GC-HQ", "CHURCH-01", "CALABAR-CAT").
 * Min 3 characters, max 25 characters.
 */
export const CHURCH_CODE_REGEX = /^[A-Z0-9]{2,12}(-[A-Z0-9]{1,10})*$/;

export const validateChurchCode = (
  code: string
): { isValid: boolean; error: string | null } => {
  const trimmed = code?.trim().toUpperCase() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Organization code is required.' };
  }
  if (trimmed.length < 3 || trimmed.length > 25) {
    return {
      isValid: false,
      error: 'Code must be between 3 and 25 characters long.',
    };
  }
  if (!CHURCH_CODE_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Code must be uppercase letters, numbers, and hyphens (e.g. ACME-HQ).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 4. ORGANIZATION NAME REGEX & VALIDATOR
// ---------------------------------------------------------------------------
/**
 * Letters, numbers, spaces, and standard enterprise punctuation (&, ., ,, ', -).
 * Must contain at least 2 letters.
 */
export const ORG_NAME_REGEX = /^[a-zA-Z0-9\s&.,'’\-()]{2,100}$/;

export const validateOrgName = (
  name: string
): { isValid: boolean; error: string | null } => {
  const trimmed = name?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Organization name is required.' };
  }
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Organization name must be at least 2 characters.',
    };
  }
  if (!/[a-zA-Z]{2,}/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Organization name must contain at least 2 alphabetical letters.',
    };
  }
  if (!ORG_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Organization name contains invalid characters.',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 5. BRANCH / CATHEDRAL NAME REGEX & VALIDATOR
// ---------------------------------------------------------------------------
export const BRANCH_NAME_REGEX = /^[a-zA-Z0-9\s&.,'’\-()]{2,100}$/;

export const validateBranchName = (
  name: string
): { isValid: boolean; error: string | null } => {
  const trimmed = name?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Branch / cathedral name is required.' };
  }
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Branch name must be at least 2 characters.',
    };
  }
  if (!/[a-zA-Z]{2,}/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Branch name must contain at least 2 alphabetical letters.',
    };
  }
  if (!BRANCH_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Branch name contains invalid characters.',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 6. PERSON FULL NAME REGEX & VALIDATOR (Administrator / Staff)
// ---------------------------------------------------------------------------
/**
 * Human full name: letters, spaces, dots, hyphens, and apostrophes.
 * No numbers or symbols allowed.
 */
export const PERSON_NAME_REGEX = /^[a-zA-Z\s.'’\-]{2,70}$/;

export const validatePersonName = (
  name: string
): { isValid: boolean; error: string | null } => {
  const trimmed = name?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Full name is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Full name must be at least 2 characters.' };
  }
  if (!/[a-zA-Z]{2,}/.test(trimmed)) {
    return { isValid: false, error: 'Full name must contain real letters.' };
  }
  if (!PERSON_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Name cannot contain numbers or special symbols (e.g. John Doe).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 7. DEPARTMENT / UNIT NAME REGEX & VALIDATOR
// ---------------------------------------------------------------------------
export const DEPT_NAME_REGEX = /^[a-zA-Z0-9\s&/\-()]{2,60}$/;

export const validateDeptName = (
  dept: string
): { isValid: boolean; error: string | null } => {
  const trimmed = dept?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Department name is required.' };
  }
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Department name must be at least 2 characters.',
    };
  }
  if (!/[a-zA-Z]{2,}/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Department name must contain at least 2 alphabetical letters.',
    };
  }
  if (!DEPT_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Department name contains invalid characters (letters, numbers, & and / allowed).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 8. WI-FI HARDWARE BSSID / MAC ADDRESS REGEX & VALIDATOR
// ---------------------------------------------------------------------------
/**
 * Matches 6 hex octets with colon or hyphen separators (e.g. 0c:61:f9:65:8f:07 or 0C-61-F9-65-8F-07).
 */
export const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export const validateMacAddress = (
  bssid: string
): { isValid: boolean; error: string | null } => {
  const trimmed = bssid?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Hardware BSSID / MAC address is required.' };
  }
  if (!MAC_ADDRESS_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'BSSID must be a 6-octet hardware MAC address (e.g. 0c:61:f9:65:8f:07).',
    };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 9. WI-FI ROUTER SSID REGEX & VALIDATOR
// ---------------------------------------------------------------------------
export const SSID_REGEX = /^[\x20-\x7E]{1,32}$/;

export const validateSsid = (
  ssid: string
): { isValid: boolean; error: string | null } => {
  const trimmed = ssid?.trim() || '';
  if (!trimmed) {
    return { isValid: false, error: 'Router SSID label is required.' };
  }
  if (trimmed.length < 2 || trimmed.length > 32) {
    return {
      isValid: false,
      error: 'SSID label must be between 2 and 32 characters.',
    };
  }
  if (!SSID_REGEX.test(trimmed)) {
    return { isValid: false, error: 'SSID contains invalid characters.' };
  }
  return { isValid: true, error: null };
};

// ---------------------------------------------------------------------------
// 10. GEOLOCATION COORDINATES REGEX & VALIDATOR
// ---------------------------------------------------------------------------
export const LATITUDE_REGEX = /^-?([0-8]?\d(\.\d+)?|90(\.0+)?)$/;
export const LONGITUDE_REGEX = /^-?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

export const validateCoordinates = (
  lat: number | string,
  lng: number | string
): { isValid: boolean; error: string | null } => {
  const latStr = String(lat ?? '').trim();
  const lngStr = String(lng ?? '').trim();
  if (!latStr || !lngStr) {
    return { isValid: false, error: 'Latitude and Longitude are required.' };
  }
  if (!LATITUDE_REGEX.test(latStr)) {
    return {
      isValid: false,
      error: 'Latitude must be a valid number between -90 and 90.',
    };
  }
  if (!LONGITUDE_REGEX.test(lngStr)) {
    return {
      isValid: false,
      error: 'Longitude must be a valid number between -180 and 180.',
    };
  }
  return { isValid: true, error: null };
};
