import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
}

interface SidebarProps {
  title?: string;
  items: NavItem[];
}

export function Sidebar({ title, items }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-surface border-r border-border
      border-l-3 border-l-curtain">
      <div className="p-5 border-b border-border">
        <h2 className="font-heading text-lg text-accent truncate">
          {title || 'Digital Call Board'}
        </h2>
        {user && <p className="text-xs text-muted mt-1 truncate">{user.name}</p>}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `
              block px-3 py-2 rounded-md text-sm transition-colors
              ${isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-muted hover:text-foreground hover:bg-surface-raised'}
            `}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <NavLink
          to="/account"
          className={({ isActive }) => `
            block px-3 py-2 rounded-md text-sm transition-colors
            ${isActive ? 'text-accent' : 'text-muted hover:text-foreground'}
          `}
        >
          Account
        </NavLink>
        <button
          onClick={handleLogout}
          className="block w-full text-left px-3 py-2 rounded-md text-sm text-muted
            hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
