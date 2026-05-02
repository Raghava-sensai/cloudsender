export interface Trigger {
  id: string;
  workspaceId: string;
  name: string;
  eventType: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
  templateId: string | null;
  cooldownSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  workspaceId: string;
  eventType: string;
  name: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  jobId: string;
  userId: string;
  workspaceId: string | null;
  eventType: string;
  recipientEmail: string | null;
  status: string;
  attempts: number;
  providerMessageId: string | null;
  providerStatusCode: number | null;
  error: string | null;
  createdAt: string;
}

export interface TestEventPayload {
  userId: string;
  eventType: string;
  metadata: {
    email: string;
    workspaceId: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

export interface DashboardUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface LoginResult {
  token: string;
  user: DashboardUser;
}

export interface EmailPreview {
  to: string | null;
  subject: string;
  text: string;
  html: string;
}

export const EVENT_TYPES = [
  "user.signup",
  "user.trial_started",
  "user.trial_ending",
  "user.subscription_created",
  "user.subscription_cancelled",
  "credits.low",
  "credits.exhausted",
] as const;
