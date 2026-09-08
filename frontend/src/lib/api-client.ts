import { getCurrentIdToken } from './firebase-client';

const DEFAULT_TOKEN = 'demo-token-citizen';

export function getAuthToken(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('civicpulse_auth_token') || DEFAULT_TOKEN;
  }
  return DEFAULT_TOKEN;
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('civicpulse_auth_token', token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('civicpulse_auth_token');
  }
}

/**
 * Resolves the active authorization token asynchronously.
 * In DEMO_MODE: returns the stored persona demo token.
 * In REAL_MODE: queries the current Firebase ID token.
 */
export async function getAuthTokenAsync(): Promise<string> {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  if (isDemoMode) {
    return getAuthToken();
  }

  if (typeof window !== 'undefined') {
    try {
      const firebaseToken = await getCurrentIdToken();
      if (firebaseToken) {
        return firebaseToken;
      }
    } catch {
      // Fall through if token retrieval fails
    }
  }

  return '';
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const customHeaders = (options.headers as Record<string, string>) || {};
  let token = customHeaders['Authorization'] ? '' : await getAuthTokenAsync();
  if (token && token.startsWith('Bearer ')) {
    token = token.substring(7).trim();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders
  };

  const url = endpoint.startsWith('http') ? endpoint : endpoint;

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (!res.ok) {
    if (res.status === 401) {
      console.warn(`[CivicPulse API] 401 Unauthorized for ${endpoint}`);
    } else if (res.status === 403) {
      console.warn(`[CivicPulse API] 403 Forbidden for ${endpoint}`);
    }

    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Body not JSON
    }

    const message = errorData?.error?.message || `Request failed with status ${res.status}`;
    const code =
      errorData?.error?.code ||
      (res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : 'UNKNOWN_ERROR');
    const requestId = errorData?.error?.requestId || res.headers.get('x-request-id') || undefined;

    throw new ApiError(res.status, code, message, requestId);
  }

  return res.json();
}

export const apiClient = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', headers }),

  post: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers
    }),

  put: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers
    }),

  patch: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers
    }),

  uploadFile: async (uploadUrl: string, file: File | Blob, mimeType: string): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType
      },
      body: file
    });

    if (!res.ok) {
      throw new Error(`Media upload failed with status ${res.status}`);
    }
  }
};
