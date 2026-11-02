import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ExternalLink, LogOut, Send, Slack, Unplug } from 'lucide-react';
import { startSlackConnect, useDisconnectSlack, useSlackStatus, useTestSlack } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Popover } from '../ui/Popover';
import { Spinner } from '../ui/Spinner';

const itemCls =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface disabled:opacity-50';

/** Sidebar user card (Figma) with a dropdown for Slack, queue dashboard and logout. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const slack = useSlackStatus();
  const disconnect = useDisconnectSlack();
  const test = useTestSlack();
  const [connecting, setConnecting] = useState(false);

  if (!user) return null;

  const connect = async () => {
    setConnecting(true);
    try {
      await startSlackConnect();
    } catch (e) {
      toast.error((e as Error).message);
      setConnecting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left hover:bg-[#ededed]"
      >
        <Avatar name={user.name} src={user.avatarUrl} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-medium">{user.name}</span>
          <span className="block truncate text-xs text-[#6b6b6b]">{user.email}</span>
        </span>
        <ChevronDown size={18} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} className="left-0 right-0 top-full mt-2 p-2">
        <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted">Slack alerts</p>
        {slack.isLoading ? (
          <div className="px-3 py-2">
            <Spinner className="h-4 w-4 text-brand" />
          </div>
        ) : slack.data?.connected ? (
          <>
            <div className="px-3 py-1.5 text-xs text-[#4b4b4b]">
              Connected to <b>{slack.data.teamName}</b>
              {slack.data.channelName && <> · {slack.data.channelName}</>}
            </div>
            <button
              className={itemCls}
              disabled={test.isPending}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: () => toast.success('Test message sent to Slack'),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <Send size={16} /> Send test message
            </button>
            <button
              className={itemCls}
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast.success('Slack disconnected') })}
            >
              <Unplug size={16} /> Disconnect Slack
            </button>
          </>
        ) : (
          <button
            className={itemCls}
            disabled={connecting || !slack.data?.configured}
            title={slack.data?.configured ? undefined : 'Set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET on the backend'}
            onClick={connect}
          >
            <Slack size={16} /> {slack.data?.configured ? 'Connect Slack' : 'Slack not configured'}
          </button>
        )}

        <div className="my-1.5 h-px bg-line" />
        <a className={itemCls} href="/admin/queues" target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Queue dashboard
        </a>
        <button className={itemCls} onClick={() => void logout()}>
          <LogOut size={16} /> Logout
        </button>
      </Popover>
    </div>
  );
}
