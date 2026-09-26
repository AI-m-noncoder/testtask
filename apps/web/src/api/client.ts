const TOKEN_KEY = 'org-users.token';

// Storage can be unavailable (private mode, blocked site data): degrade to "logged out"
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Error with the API's machine-readable code (`{ code, message, details }`) */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized = () => {};

/** Called when an authenticated request gets 401 (expired token, deleted account) */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

type QueryValue = string | number | undefined | null;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue> | object;
}

export async function api<T>(
  path: string,
  { method = 'GET', body, query }: RequestOptions = {},
): Promise<T> {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {}) as Array<[string, QueryValue]>) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }

  const token = tokenStorage.get();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as {
    code?: string;
    message?: string;
    details?: unknown;
  } | null;

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStorage.clear();
      onUnauthorized();
    }
    throw new ApiError(
      res.status,
      data?.code ?? 'UNKNOWN',
      data?.message ?? res.statusText,
      data?.details,
    );
  }
  return data as T;
}
