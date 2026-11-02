import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { FullPageSpinner } from './components/ui/Spinner';
import { LoginPage } from './pages/LoginPage';
import { MailboxPage } from './pages/MailboxPage';
import { ComposePage } from './pages/ComposePage';
import { EmailDetailPage } from './pages/EmailDetailPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/scheduled" element={<MailboxPage key="scheduled" folder="scheduled" />} />
          <Route path="/sent" element={<MailboxPage key="sent" folder="sent" />} />
        </Route>
        {/* Full-width pages (no sidebar), as in the Figma */}
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/emails/:id" element={<EmailDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/scheduled" replace />} />
    </Routes>
  );
}
