import { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useAppConfig } from '../../api/hooks';
import { Sidebar } from './Sidebar';

/** Sidebar + main content. Also surfaces the result of the Slack OAuth redirect. */
export function AppLayout() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: config } = useAppConfig();

  useEffect(() => {
    const slack = params.get('slack');
    if (!slack) return;
    if (slack === 'connected') toast.success('Slack connected!');
    else toast.error('Could not connect Slack');
    void qc.invalidateQueries({ queryKey: queryKeys.slack });
    params.delete('slack');
    setParams(params, { replace: true });
  }, [params, setParams, qc]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pr-6 pl-2 pt-5">
        {config?.simulatedDelivery && (
          <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            {"Demo mode: SMTP is blocked on Railway's free plan, so emails are simulated (queued, rate-limited and marked Sent, but not delivered). Run the project locally to send for real via Ethereal."}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
