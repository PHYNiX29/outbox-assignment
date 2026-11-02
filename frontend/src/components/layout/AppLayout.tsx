import { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/hooks';
import { Sidebar } from './Sidebar';

/** Sidebar + main content. Also surfaces the result of the Slack OAuth redirect. */
export function AppLayout() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

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
        <Outlet />
      </main>
    </div>
  );
}
