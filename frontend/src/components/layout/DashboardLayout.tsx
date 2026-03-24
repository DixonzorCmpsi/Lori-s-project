import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Account', path: '/account' },
];

export function DashboardLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar title="Digital Call Board" items={NAV_ITEMS} />
      <main className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8 max-w-5xl mx-auto w-full">
        {user && !user.email_verified && (
          <div className="bg-warning/10 border border-warning rounded-md px-4 py-3 mb-6 text-sm text-warning">
            Please verify your email to access all features.
          </div>
        )}
        <Outlet />
      </main>
      <MobileNav items={NAV_ITEMS} />
    </div>
  );
}
