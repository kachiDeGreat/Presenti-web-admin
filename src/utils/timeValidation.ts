// Time validation utilities and window verification
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export interface TimeWindowValidationResult {
  isValid: boolean;
  isOpenValidFormat: boolean;
  isCloseValidFormat: boolean;
  isSignOutValidFormat: boolean;
  isOrderValid: boolean;
  errorMessage: string | null;
  openMinutes: number;
  closeMinutes: number;
  signOutMinutes?: number;
  durationMinutes: number;
  formattedOpen: string;
  formattedClose: string;
  formattedSignOut?: string;
}

/**
 * Parses HH:mm string to minutes from midnight using regex.
 * Returns null if format does not strictly match TIME_REGEX.
 */
export const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(TIME_REGEX);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

/**
 * Formats 24-hour time (HH:mm) into human-readable 12-hour format (e.g. "08:00 AM", "01:30 PM").
 */
export const format12Hour = (timeStr: string): string => {
  if (!timeStr || typeof timeStr !== 'string') return timeStr || '';
  const match = timeStr.trim().match(TIME_REGEX);
  if (!match) return timeStr;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Formats duration in minutes to human readable string (e.g., "30 mins", "1 hr 15 mins")
 */
export const formatDurationMinutes = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0 mins';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours} hr ${mins} min${mins > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${mins} min${mins > 1 ? 's' : ''}`;
};

/**
 * Validates attendance window:
 * 1. Open time must match TIME_REGEX
 * 2. Close time must match TIME_REGEX
 * 3. Close time MUST be strictly greater than Open time (closeMinutes > openMinutes)
 * 4. If Sign-Out is enabled, Sign-Out time must match TIME_REGEX
 */
export const validateAttendanceWindow = (
  openTime: string,
  closeTime: string,
  enableSignOut?: boolean,
  signOutTime?: string
): TimeWindowValidationResult => {
  const isOpenValidFormat = TIME_REGEX.test(openTime?.trim() || '');
  const isCloseValidFormat = TIME_REGEX.test(closeTime?.trim() || '');
  const isSignOutValidFormat = enableSignOut
    ? TIME_REGEX.test(signOutTime?.trim() || '')
    : true;

  const openMinutes = parseTimeToMinutes(openTime) ?? -1;
  const closeMinutes = parseTimeToMinutes(closeTime) ?? -1;
  const signOutMinutes = enableSignOut && signOutTime ? parseTimeToMinutes(signOutTime) ?? -1 : undefined;

  const formattedOpen = isOpenValidFormat ? format12Hour(openTime) : openTime;
  const formattedClose = isCloseValidFormat ? format12Hour(closeTime) : closeTime;
  const formattedSignOut = signOutTime && isSignOutValidFormat ? format12Hour(signOutTime) : signOutTime;

  if (!isOpenValidFormat) {
    return {
      isValid: false,
      isOpenValidFormat: false,
      isCloseValidFormat,
      isSignOutValidFormat,
      isOrderValid: false,
      errorMessage: 'Sign-In Window Open Time must follow standard 24-hour time format (HH:mm).',
      openMinutes,
      closeMinutes,
      signOutMinutes,
      durationMinutes: 0,
      formattedOpen,
      formattedClose,
      formattedSignOut,
    };
  }

  if (!isCloseValidFormat) {
    return {
      isValid: false,
      isOpenValidFormat: true,
      isCloseValidFormat: false,
      isSignOutValidFormat,
      isOrderValid: false,
      errorMessage: 'Sign-In Window Close Time must follow standard 24-hour time format (HH:mm).',
      openMinutes,
      closeMinutes,
      signOutMinutes,
      durationMinutes: 0,
      formattedOpen,
      formattedClose,
      formattedSignOut,
    };
  }

  if (closeMinutes <= openMinutes) {
    return {
      isValid: false,
      isOpenValidFormat: true,
      isCloseValidFormat: true,
      isSignOutValidFormat,
      isOrderValid: false,
      errorMessage: `Sign-In Window Close Time (${formattedClose}) must be later than Sign-In Window Open Time (${formattedOpen}).`,
      openMinutes,
      closeMinutes,
      signOutMinutes,
      durationMinutes: 0,
      formattedOpen,
      formattedClose,
      formattedSignOut,
    };
  }

  if (enableSignOut && !isSignOutValidFormat) {
    return {
      isValid: false,
      isOpenValidFormat: true,
      isCloseValidFormat: true,
      isSignOutValidFormat: false,
      isOrderValid: true,
      errorMessage: 'Sign-Out Time must follow standard 24-hour time format (HH:mm, e.g. 17:00).',
      openMinutes,
      closeMinutes,
      signOutMinutes,
      durationMinutes: closeMinutes - openMinutes,
      formattedOpen,
      formattedClose,
      formattedSignOut,
    };
  }

  return {
    isValid: true,
    isOpenValidFormat: true,
    isCloseValidFormat: true,
    isSignOutValidFormat: true,
    isOrderValid: true,
    errorMessage: null,
    openMinutes,
    closeMinutes,
    signOutMinutes,
    durationMinutes: closeMinutes - openMinutes,
    formattedOpen,
    formattedClose,
    formattedSignOut,
  };
};

export interface DaySchedulesValidationResult {
  isValid: boolean;
  dayErrors: Record<number, string>;
  firstError?: string;
}

export const validateDaySchedules = (
  serviceDays: number[],
  daySchedules: Record<number | string, import('../types').DaySchedule>,
  defaultSchedule: import('../types').DaySchedule
): DaySchedulesValidationResult => {
  const dayErrors: Record<number, string> = {};
  let firstError: string | undefined;
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const day of serviceDays) {
    const sched = daySchedules[day] || defaultSchedule;
    const openTime = sched.arrivalCutoff || defaultSchedule.arrivalCutoff || '07:00';
    const closeTime = sched.lateTolerance || defaultSchedule.lateTolerance || '07:30';
    const enableSignOut = sched.enableSignOut !== undefined ? sched.enableSignOut : defaultSchedule.enableSignOut;
    const signOutTime = sched.signOutTime || defaultSchedule.signOutTime || '17:00';

    const result = validateAttendanceWindow(openTime, closeTime, enableSignOut, signOutTime);
    if (!result.isValid) {
      const name = DAY_NAMES[day] || `Day ${day}`;
      const msg = `${name}: ${result.errorMessage}`;
      dayErrors[day] = msg;
      if (!firstError) firstError = msg;
    }
  }

  return {
    isValid: Object.keys(dayErrors).length === 0,
    dayErrors,
    firstError,
  };
};
