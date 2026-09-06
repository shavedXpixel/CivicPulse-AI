export interface ApiResponse<T> {
  data: T;
  pagination?: {
    limit: number;
    next_cursor?: string;
    total?: number;
  };
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
