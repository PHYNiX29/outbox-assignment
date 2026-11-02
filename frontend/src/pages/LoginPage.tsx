import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppConfig } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const ERRORS: Record<string, string> = {
  google_not_configured: 'Google login is not configured on the server yet (set GOOGLE_CLIENT_ID / SECRET).',
  google_failed: 'Google login failed. Please try again.',
};

export function LoginPage() {
  const { user, loginWithPassword } = useAuth();
  const { data: config } = useAppConfig();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const err = params.get('error');
    if (err) toast.error(ERRORS[err] ?? 'Login failed');
  }, [params]);

  if (user) return <Navigate to="/scheduled" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginWithPassword(email, password);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-white px-4">
      <div className="w-full max-w-[338px] rounded-lg border border-line px-10 pb-9 pt-9">
        <h1 className="text-center text-[26px] font-semibold">Login</h1>

        <a
          href="/api/auth/google"
          aria-disabled={config && !config.googleEnabled}
          title={config && !config.googleEnabled ? 'Google OAuth keys not configured yet' : undefined}
          className="mt-5 flex h-8 items-center justify-center gap-2.5 rounded-lg bg-brand-soft text-[11px] hover:bg-[#d8eedf]"
        >
          <GoogleIcon /> Login with Google
        </a>

        <div className="my-5 flex items-center gap-3 text-[9px] text-[#a3a3a3]">
          <span className="h-px flex-1 bg-line" />
          or sign up through email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
          <Input
            type="email"
            required
            placeholder="Email ID"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-[10px] h-[38px]"
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-[10px] h-[38px]"
          />
          <Button type="submit" loading={submitting} className="mt-3 h-8 text-[11px] font-normal">
            Login
          </Button>
        </form>
      </div>
    </div>
  );
}
