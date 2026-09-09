import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";

// Storage keys for authentication persistence
export const STORAGE_KEYS = {
  API_KEY: "aegis_user_api_key",
  REFRESH_TOKEN: "aegis_user_refresh_token",
  SESSION_EXPIRY: "aegis_session_expiry",
  AUTO_REFRESH_ENABLED: "aegis_auto_refresh_enabled",
} as const;

// Default fallback credentials for quick offline / demo use
export const DEFAULT_CREDENTIALS = {
  API_KEY: "aegis_sec_live_9f81a702b8d9102c91823746a5b",
  REFRESH_TOKEN: "aegis_ref_tok_849204810293_alpha",
};

// Custom configuration flags extendable on request
export interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuth?: boolean;
  force401Simulation?: boolean;
  failRefreshSimulation?: boolean;
}

// Log event for inspecting interceptor activity in real-time
export interface InterceptorLogEntry {
  id: string;
  timestamp: string;
  type: 
    | "request_intercepted" 
    | "response_success" 
    | "401_caught" 
    | "session_refreshing" 
    | "session_refreshed" 
    | "refresh_failed" 
    | "reauth_prompted" 
    | "reauth_completed"
    | "error";
  url: string;
  method?: string;
  statusCode?: number;
  message: string;
  apiKeyAttached?: string;
  details?: Record<string, any>;
}

export type InterceptorEvent = InterceptorLogEntry;

// Re-authentication context sent to the modal
export interface AuthRequiredContext {
  id: string;
  reason: "unauthorized_401" | "refresh_failed" | "no_refresh_token" | "manual_prompt" | "token_expired";
  failedUrl: string;
  statusCode: number;
  currentApiKey?: string;
  timestamp: string;
  retryRequest: (newKey?: string) => Promise<any>;
  cancelRequest: (reason?: string) => void;
}

// Subscriber types
type AuthRequiredListener = (context: AuthRequiredContext) => void;
type InterceptorLogListener = (log: InterceptorLogEntry) => void;

// Active listeners and queued requests state
const authRequiredListeners = new Set<AuthRequiredListener>();
const interceptorLogListeners = new Set<InterceptorLogListener>();
const logHistory: InterceptorLogEntry[] = [];
const MAX_LOG_HISTORY = 100;

// Token refresh lock and pending request queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

// Helper to append and notify log entries
export function logInterceptorEvent(entry: Omit<InterceptorLogEntry, "id" | "timestamp">): InterceptorLogEntry {
  const fullEntry: InterceptorLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    ...entry,
  };
  
  logHistory.unshift(fullEntry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.pop();
  }

  interceptorLogListeners.forEach((listener) => {
    try {
      listener(fullEntry);
    } catch (e) {
      console.error("Interceptor log listener error:", e);
    }
  });

  return fullEntry;
}

export function getInterceptorLogs(): InterceptorLogEntry[] {
  return [...logHistory];
}

export function clearInterceptorLogs(): void {
  logHistory.length = 0;
}

export function onInterceptorLog(listener: InterceptorLogListener): () => void {
  interceptorLogListeners.add(listener);
  return () => {
    interceptorLogListeners.delete(listener);
  };
}

// Auth required event subscription
export function onAuthRequired(listener: AuthRequiredListener): () => void {
  authRequiredListeners.add(listener);
  return () => {
    authRequiredListeners.delete(listener);
  };
}

export function notifyAuthRequired(context: AuthRequiredContext): void {
  logInterceptorEvent({
    type: "reauth_prompted",
    url: context.failedUrl,
    statusCode: context.statusCode,
    message: `Prompting operator re-authentication modal due to: ${context.reason}`,
    details: { reason: context.reason, currentKey: context.currentApiKey },
  });

  authRequiredListeners.forEach((listener) => {
    try {
      listener(context);
    } catch (e) {
      console.error("AuthRequired listener error:", e);
    }
  });
}

// Token & Session Storage Management
export function getApiKey(): string {
  if (typeof window === "undefined") return DEFAULT_CREDENTIALS.API_KEY;
  try {
    const key = localStorage.getItem(STORAGE_KEYS.API_KEY);
    return key && key.trim() ? key : DEFAULT_CREDENTIALS.API_KEY;
  } catch {
    return DEFAULT_CREDENTIALS.API_KEY;
  }
}

export function setApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  try {
    if (apiKey && apiKey.trim()) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
    // Update default auth header on apiClient instance as well
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${apiKey.trim()}`;
    apiClient.defaults.headers.common["X-API-Key"] = apiKey.trim();
  } catch (e) {
    console.error("Failed to persist API key:", e);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return DEFAULT_CREDENTIALS.REFRESH_TOKEN;
  try {
    const token = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    return token !== null ? token : DEFAULT_CREDENTIALS.REFRESH_TOKEN;
  } catch {
    return DEFAULT_CREDENTIALS.REFRESH_TOKEN;
  }
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
  } catch (e) {
    console.error("Failed to set refresh token:", e);
  }
}

export function isAutoRefreshEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(STORAGE_KEYS.AUTO_REFRESH_ENABLED);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setAutoRefreshEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_REFRESH_ENABLED, String(enabled));
  } catch (e) {
    console.error("Failed to set auto-refresh setting:", e);
  }
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
    delete apiClient.defaults.headers.common["Authorization"];
    delete apiClient.defaults.headers.common["X-API-Key"];
  } catch (e) {
    console.error("Failed to clear auth session:", e);
  }
}

// Process all queued requests after token refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Create the primary configured Axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: "/",
  timeout: 25000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// REQUEST INTERCEPTOR: Automatically attaches user's API key to every outgoing request
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const customConfig = config as CustomRequestConfig;

    // Check if auth should be skipped for this specific request
    if (customConfig.skipAuth) {
      logInterceptorEvent({
        type: "request_intercepted",
        url: config.url || "unknown",
        method: config.method?.toUpperCase(),
        message: `Outgoing request to ${config.url} (Auth skipped by request flag)`,
      });
      return config;
    }

    // Retrieve active API key
    const currentApiKey = getApiKey();

    if (currentApiKey) {
      // Standard Bearer token and enterprise X-API-Key header
      const headers = config.headers as any;
      if (headers) {
        if (typeof headers.set === "function") {
          headers.set("Authorization", `Bearer ${currentApiKey}`);
          headers.set("X-API-Key", currentApiKey);
        } else {
          headers["Authorization"] = `Bearer ${currentApiKey}`;
          headers["X-API-Key"] = currentApiKey;
        }

        // Also attach refresh token if available for transparent session continuity
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          if (typeof headers.set === "function") {
            headers.set("X-Refresh-Token", refreshToken);
          } else {
            headers["X-Refresh-Token"] = refreshToken;
          }
        }
      }

      const refreshToken = getRefreshToken();

      logInterceptorEvent({
        type: "request_intercepted",
        url: config.url || "unknown",
        method: config.method?.toUpperCase(),
        apiKeyAttached: `${currentApiKey.substring(0, 14)}...`,
        message: `Attached API key [${currentApiKey.substring(0, 10)}...] to ${config.method?.toUpperCase()} ${config.url}`,
        details: {
          headersAttached: ["Authorization (Bearer)", "X-API-Key", refreshToken ? "X-Refresh-Token" : ""].filter(Boolean),
        },
      });
    } else {
      logInterceptorEvent({
        type: "request_intercepted",
        url: config.url || "unknown",
        method: config.method?.toUpperCase(),
        message: `Warning: No API key found in storage for ${config.method?.toUpperCase()} ${config.url}`,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    logInterceptorEvent({
      type: "error",
      url: error.config?.url || "unknown",
      message: `Request interceptor error: ${error.message}`,
    });
    return Promise.reject(error);
  }
);

// RESPONSE INTERCEPTOR: Handles 401 Unauthorized errors by refreshing session or prompting modal
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    logInterceptorEvent({
      type: "response_success",
      url: response.config.url || "unknown",
      method: response.config.method?.toUpperCase(),
      statusCode: response.status,
      message: `${response.config.method?.toUpperCase()} ${response.config.url} returned ${response.status} OK`,
    });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomRequestConfig | undefined;

    // Only intercept standard HTTP response errors with status 401
    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    const failedUrl = originalRequest.url || "/api/unknown";
    const currentApiKey = getApiKey();

    logInterceptorEvent({
      type: "401_caught",
      url: failedUrl,
      method: originalRequest.method?.toUpperCase(),
      statusCode: 401,
      message: `401 Unauthorized caught on ${originalRequest.method?.toUpperCase()} ${failedUrl}`,
      details: {
        errorData: error.response.data,
      },
    });

    // Prevent recursive loop if request was already retried once
    if (originalRequest._retry) {
      logInterceptorEvent({
        type: "refresh_failed",
        url: failedUrl,
        statusCode: 401,
        message: `Request already retried once. Rejecting and opening re-authentication modal.`,
      });

      // Prompt modal immediately since refresh token / retry also resulted in 401
      return new Promise((resolve, reject) => {
        notifyAuthRequired({
          id: `reauth-${Date.now()}`,
          reason: "unauthorized_401",
          failedUrl,
          statusCode: 401,
          currentApiKey,
          timestamp: new Date().toISOString(),
          retryRequest: async (newKey?: string) => {
            if (newKey) setApiKey(newKey);
            originalRequest._retry = false;
            try {
              const res = await apiClient(originalRequest);
              resolve(res);
            } catch (err) {
              reject(err);
            }
          },
          cancelRequest: (reason) => {
            reject(new Error(reason || "User cancelled re-authentication modal"));
          },
        });
      });
    }

    // Mark that this request is now undergoing 401 handling
    originalRequest._retry = true;

    // Check if auto-refresh is enabled and a refresh token is present
    const refreshToken = getRefreshToken();
    const shouldAttemptRefresh = isAutoRefreshEnabled() && !!refreshToken && !originalRequest.failRefreshSimulation;

    // If another request is currently refreshing the session, queue this request
    if (isRefreshing) {
      logInterceptorEvent({
        type: "session_refreshing",
        url: failedUrl,
        message: `Token refresh already in progress. Queuing request for ${failedUrl}...`,
      });

      return new Promise<AxiosResponse>((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              originalRequest.headers["X-API-Key"] = newToken;
            }
            resolve(apiClient(originalRequest));
          },
          reject: (err: any) => {
            reject(err);
          },
        });
      });
    }

    // Case 1: Session Refresh is feasible -> Attempt automated refresh via backend
    if (shouldAttemptRefresh) {
      isRefreshing = true;
      logInterceptorEvent({
        type: "session_refreshing",
        url: "/api/auth/refresh",
        message: `Attempting automated session refresh using refresh token [${refreshToken.substring(0, 10)}...]`,
      });

      try {
        // Use raw axios or standalone call with skipAuth so it doesn't trigger interceptor loops
        const refreshResponse = await axios.post<{
          success: boolean;
          apiKey: string;
          refreshToken?: string;
          message?: string;
        }>(
          "/api/auth/refresh",
          {
            refreshToken,
            currentKey: currentApiKey,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Refresh-Token": refreshToken,
            },
            timeout: 10000,
          }
        );

        if (refreshResponse.data && refreshResponse.data.success && refreshResponse.data.apiKey) {
          const newApiKey = refreshResponse.data.apiKey;
          const newRefreshToken = refreshResponse.data.refreshToken || refreshToken;

          // Update credentials in storage
          setApiKey(newApiKey);
          setRefreshToken(newRefreshToken);

          logInterceptorEvent({
            type: "session_refreshed",
            url: "/api/auth/refresh",
            apiKeyAttached: `${newApiKey.substring(0, 14)}...`,
            message: `Session refreshed successfully! Retrying queued requests with new key...`,
          });

          // Unblock queued requests with new token
          processQueue(null, newApiKey);

          // Update original request headers and replay
          if (originalRequest.headers) {
            originalRequest.headers["Authorization"] = `Bearer ${newApiKey}`;
            originalRequest.headers["X-API-Key"] = newApiKey;
          }

          return apiClient(originalRequest);
        } else {
          throw new Error("Refresh endpoint returned unsuccessful status");
        }
      } catch (refreshErr: any) {
        logInterceptorEvent({
          type: "refresh_failed",
          url: "/api/auth/refresh",
          statusCode: refreshErr?.response?.status || 500,
          message: `Automatic session refresh failed (${refreshErr.message}). Prompting operator re-auth modal.`,
        });

        // Fail all queued requests and trigger modal
        processQueue(refreshErr, null);

        return new Promise<AxiosResponse>((resolve, reject) => {
          notifyAuthRequired({
            id: `reauth-${Date.now()}`,
            reason: "refresh_failed",
            failedUrl,
            statusCode: 401,
            currentApiKey,
            timestamp: new Date().toISOString(),
            retryRequest: async (newKey?: string) => {
              if (newKey) setApiKey(newKey);
              originalRequest._retry = false;
              try {
                const res = await apiClient(originalRequest);
                resolve(res);
              } catch (retryErr) {
                reject(retryErr);
              }
            },
            cancelRequest: (cancelReason) => {
              reject(new Error(cancelReason || "Re-authentication modal dismissed"));
            },
          });
        });
      } finally {
        isRefreshing = false;
      }
    }

    // Case 2: No refresh token or auto-refresh disabled -> Prompt user via Modal directly!
    logInterceptorEvent({
      type: "reauth_prompted",
      url: failedUrl,
      statusCode: 401,
      message: `No active refresh token available or auto-refresh disabled. Prompting re-authentication modal directly.`,
    });

    return new Promise<AxiosResponse>((resolve, reject) => {
      notifyAuthRequired({
        id: `reauth-${Date.now()}`,
        reason: refreshToken ? "unauthorized_401" : "no_refresh_token",
        failedUrl,
        statusCode: 401,
        currentApiKey,
        timestamp: new Date().toISOString(),
        retryRequest: async (newKey?: string) => {
          if (newKey) setApiKey(newKey);
          originalRequest._retry = false;
          try {
            if (originalRequest.headers && newKey) {
              originalRequest.headers["Authorization"] = `Bearer ${newKey}`;
              originalRequest.headers["X-API-Key"] = newKey;
            }
            const res = await apiClient(originalRequest);
            resolve(res);
          } catch (retryErr) {
            reject(retryErr);
          }
        },
        cancelRequest: (cancelReason) => {
          reject(new Error(cancelReason || "Re-authentication cancelled by operator"));
        },
      });
    });
  }
);

// Manual trigger helper for testing or UI actions
export function triggerManualReauth(options?: {
  failedUrl?: string;
  reason?: AuthRequiredContext["reason"];
}): Promise<string> {
  return new Promise((resolve, reject) => {
    notifyAuthRequired({
      id: `manual-reauth-${Date.now()}`,
      reason: options?.reason || "manual_prompt",
      failedUrl: options?.failedUrl || "/api/auth/manual-verification",
      statusCode: 401,
      currentApiKey: getApiKey(),
      timestamp: new Date().toISOString(),
      retryRequest: async (newKey?: string) => {
        if (newKey) {
          setApiKey(newKey);
          resolve(newKey);
        } else {
          resolve(getApiKey());
        }
      },
      cancelRequest: (reason) => {
        reject(new Error(reason || "Operator cancelled manual re-authentication"));
      },
    });
  });
}

// Helper to test protected endpoints and 401 scenarios
export async function testProtectedEndpoint(options?: {
  force401?: boolean;
  failRefresh?: boolean;
}): Promise<{
  success: boolean;
  data: any;
  status: number;
  retried?: boolean;
}> {
  const queryParams = new URLSearchParams();
  if (options?.force401) queryParams.set("force401", "true");
  if (options?.failRefresh) queryParams.set("failRefresh", "true");

  const url = `/api/auth/test-protected${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  
  const customConfig: CustomRequestConfig = {
    url,
    method: "GET",
    headers: {} as any,
    failRefreshSimulation: options?.failRefresh,
  };

  const response = await apiClient(customConfig);
  return {
    success: true,
    data: response.data,
    status: response.status,
    retried: (customConfig as any)._retry,
  };
}

export default apiClient;
