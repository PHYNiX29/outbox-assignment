import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  AppConfig,
  EmailDetail,
  EmailListResponse,
  EmailStats,
  EmailStatus,
  Folder,
  ScheduleRequest,
  ScheduleResponse,
  Sender,
  SlackStatus,
} from './types';

export const queryKeys = {
  config: ['config'] as const,
  emails: (folder: Folder, q: string, status: EmailStatus | undefined, page: number) =>
    ['emails', folder, q, status ?? 'all', page] as const,
  email: (id: string) => ['email', id] as const,
  stats: ['stats'] as const,
  senders: ['senders'] as const,
  slack: ['slack'] as const,
};

export const useAppConfig = () =>
  useQuery({ queryKey: queryKeys.config, queryFn: () => api<AppConfig>('/auth/config'), staleTime: Infinity });

export const useEmails = (folder: Folder, q: string, status: EmailStatus | undefined, page = 1) =>
  useQuery({
    queryKey: queryKeys.emails(folder, q, status, page),
    queryFn: () => {
      const params = new URLSearchParams({ folder, page: String(page) });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      return api<EmailListResponse>(`/emails?${params}`);
    },
    placeholderData: keepPreviousData,
    // Scheduled emails change state on their own – keep the list fresh.
    refetchInterval: 5000,
  });

export const useEmail = (id: string) =>
  useQuery({ queryKey: queryKeys.email(id), queryFn: () => api<EmailDetail>(`/emails/${id}`) });

export const useStats = () =>
  useQuery({ queryKey: queryKeys.stats, queryFn: () => api<EmailStats>('/emails/stats'), refetchInterval: 5000 });

export const useSenders = () =>
  useQuery({
    queryKey: queryKeys.senders,
    queryFn: async () => (await api<{ senders: Sender[] }>('/senders')).senders,
  });

export const useScheduleCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: ScheduleRequest; idempotencyKey: string }) =>
      api<ScheduleResponse>('/campaigns', {
        method: 'POST',
        body: payload,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
};

export const useSlackStatus = () =>
  useQuery({ queryKey: queryKeys.slack, queryFn: () => api<SlackStatus>('/slack/status') });

export const useDisconnectSlack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/slack', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.slack }),
  });
};

export const useTestSlack = () => useMutation({ mutationFn: () => api('/slack/test', { method: 'POST' }) });

export async function startSlackConnect() {
  const { url } = await api<{ url: string }>('/slack/connect');
  window.location.href = url;
}
