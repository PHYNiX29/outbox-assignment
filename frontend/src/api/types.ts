export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AppConfig {
  googleEnabled: boolean;
  slackEnabled: boolean;
  /** True on Railway: SMTP is blocked there, so sends are simulated. */
  simulatedDelivery: boolean;
}

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';
export type Folder = 'scheduled' | 'sent';

export interface SenderRef {
  name: string;
  email: string;
}

export interface EmailListItem {
  id: string;
  toEmail: string;
  toName: string | null;
  from: SenderRef;
  subject: string;
  preview: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedReason: string | null;
}

export interface EmailDetail extends EmailListItem {
  body: string;
  previewUrl: string | null;
  messageId: string | null;
  attempts: number;
  createdAt: string;
}

export interface EmailListResponse {
  items: EmailListItem[];
  total: number;
  page: number;
  limit: number;
  engine?: 'elasticsearch' | 'postgres';
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
}

export interface Recipient {
  email: string;
  name?: string | null;
}

export interface ScheduleRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: Recipient[];
  startAt?: string;
  delaySeconds: number;
  hourlyLimit?: number | null;
}

export interface ScheduleResponse {
  campaignId: string;
  scheduled: number;
  startAt: string;
  duplicate: boolean;
}

export interface SlackStatus {
  configured: boolean;
  connected: boolean;
  teamName: string | null;
  channelName: string | null;
}
