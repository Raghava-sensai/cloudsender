import type {
  DashboardUser,
  EmailLog,
  EmailPreview,
  EmailTemplate,
  LoginResult,
  TestEventPayload,
  Trigger,
} from "./types";

type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      requestId: string;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
      requestId: string;
    };

const API_BASE =
  (import.meta.env.VITE_API_BASE ||
    "https://cloudflare-email-automation-worker.veeraraghava698.workers.dev"
  ).replace(/\/$/, "");

let authToken = window.localStorage.getItem("dashboardAuthToken") ?? "";

export function setAuthToken(token: string): void {
  authToken = token;
  window.localStorage.setItem("dashboardAuthToken", token);
}

export function clearAuthToken(): void {
  authToken = "";
  window.localStorage.removeItem("dashboardAuthToken");
}

export function getAuthToken(): string {
  return authToken;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  setAuthToken(result.token);
  return result;
}

export async function getCurrentUser(): Promise<DashboardUser> {
  return request<DashboardUser>("/auth/me");
}

export async function listTriggers(): Promise<Trigger[]> {
  return request<Trigger[]>("/triggers");
}

export async function createTrigger(input: Partial<Trigger>): Promise<Trigger> {
  return request<Trigger>("/triggers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTrigger(input: Partial<Trigger> & { id: string }): Promise<Trigger> {
  return request<Trigger>("/triggers", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteTrigger(id: string): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>(`/triggers?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  return request<EmailTemplate[]>("/templates");
}

export async function updateTemplate(
  input: Partial<EmailTemplate> & { id: string },
): Promise<EmailTemplate> {
  return request<EmailTemplate>("/templates", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listLogs(): Promise<EmailLog[]> {
  return request<EmailLog[]>("/logs?limit=100");
}

export async function sendTestEvent(input: TestEventPayload): Promise<unknown> {
  return request<unknown>("/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function previewTestEvent(input: TestEventPayload): Promise<EmailPreview> {
  return request<EmailPreview>("/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

type ApiRequestInit = RequestInit & {
  skipAuth?: boolean;
};

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (!init?.skipAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const body = (await response.json()) as ApiResponse<T>;

  if (!body.ok) {
    throw new Error(`${body.error.message} (${body.error.code})`);
  }

  return body.data;
}
