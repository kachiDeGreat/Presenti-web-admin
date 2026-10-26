// Enterprise form validation utilities and regex patterns.
export * from './timeValidation';

// Phone number validation
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

// Email address validation
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

// Organization code validation
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

// Organization name validation
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

// Branch name validation
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

// Person name validation
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

// Department name validation
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

// Wi-Fi MAC address validation
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

// Wi-Fi SSID validation
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

// Geolocation coordinates validation
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
