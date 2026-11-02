import { NavLink, useNavigate } from 'react-router-dom';
import { Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStats } from '../../api/hooks';
import { Button } from '../ui/Button';
import { Logo } from './Logo';
import { UserMenu } from './UserMenu';
import { cn } from '../../utils/cn';

function NavItem({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-5 py-2.5 text-[17px] transition-colors',
          isActive ? 'bg-brand-soft font-semibold' : 'hover:bg-surface',
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-sm font-normal text-[#6b6b6b]">{count}</span>}
    </NavLink>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { data: stats } = useStats();

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 px-2.5 pt-5">
      <div className="px-3.5 pb-1">
        <Logo />
      </div>
      <UserMenu />
      <Button variant="outline" rounded="full" size="lg" className="w-full" onClick={() => navigate('/compose')}>
        Compose
      </Button>
      <p className="mt-5 px-5 text-sm uppercase text-[#8a8a8a]">Core</p>
      <nav className="flex flex-col gap-1">
        <NavItem to="/scheduled" icon={<Clock size={20} />} label="Scheduled" count={stats?.scheduled} />
        <NavItem to="/sent" icon={<Send size={20} />} label="Sent" count={stats?.sent} />
      </nav>
    </aside>
  );
}
