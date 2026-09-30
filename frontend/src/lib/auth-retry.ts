import { UserRole } from '@civicpulse/shared';

export const AUTH_RETRY_CONFIG = {
  INITIAL_DELAY_MS: 2000,
  MAX_DELAY_MS: 5000,
  BACKOFF_FACTOR: 1.25,
  MAX_TOTAL_WAIT_MS: 90000 // ~90 seconds
};

/**
 * Distinguishes temporary network/connectivity failure (unreachable backend)
 * from reachable backend responses (e.g. 401, 403, 500).
 */
export function isBackendUnreachableError(err: any): boolean {
  if (!err) return false;

  // If there's an HTTP response status code, the backend was reached
  if (typeof err.status === 'number' && err.status > 0) {
    return false;
  }
  if (err.name === 'ApiError' || (err.constructor && err.constructor.name === 'ApiError')) {
    return false;
  }

  const message = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toLowerCase();
  const causeCode = String(err.cause?.code || '').toLowerCase();
  const causeMessage = String(err.cause?.message || '').toLowerCase();

  return (
    message.includes('err_connection_refused') ||
    code.includes('err_connection_refused') ||
    causeCode.includes('err_connection_refused') ||
    causeMessage.includes('err_connection_refused') ||
    message.includes('econnrefused') ||
    code.includes('econnrefused') ||
    causeCode.includes('econnrefused') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network error') ||
    message.includes('networkrequestfailed') ||
    message.includes('network_failure') ||
    message.includes('backend unavailable') ||
    (err.name === 'TypeError' && message.includes('fetch'))
  );
}

/**
 * Calculates controlled backoff delay between initial and max delays.
 */
export function calculateBackoffDelay(
  currentDelay: number,
  factor: number = AUTH_RETRY_CONFIG.BACKOFF_FACTOR,
  maxDelay: number = AUTH_RETRY_CONFIG.MAX_DELAY_MS
): number {
  return Math.min(Math.round(currentDelay * factor), maxDelay);
}

/**
 * Authoritative destination routing for all CivicPulse roles.
 */
export function determineRoleDestination(
  role?: string,
  explicitRedirect?: string | null
): string | null {
  if (!role) {
    return null;
  }

  if (explicitRedirect) {
    if (
      role === UserRole.CITIZEN &&
      (explicitRedirect.startsWith('/dashboard') ||
        explicitRedirect.startsWith('/officer') ||
        explicitRedirect.startsWith('/field-officer') ||
        explicitRedirect.startsWith('/department-officer') ||
        explicitRedirect.startsWith('/admin') ||
        explicitRedirect.startsWith('/governance'))
    ) {
      return '/citizen';
    }
    return explicitRedirect;
  }

  switch (role) {
    case UserRole.ADMIN:
    case UserRole.SYSTEM_ADMIN:
      return '/admin';
    case UserRole.DEPARTMENT_OFFICER:
      return '/department-officer';
    case UserRole.FIELD_OFFICER:
      return '/field-officer';
    case UserRole.CITIZEN:
      return '/citizen';
    default:
      return null;
  }
}
