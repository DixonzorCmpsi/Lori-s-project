import { NavLink } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
}

interface MobileNavProps {
  items: NavItem[];
}

export function MobileNav({ items }: MobileNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border
      flex justify-around py-2 z-40">
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => `
            flex flex-col items-center gap-1 px-3 py-1 text-xs min-w-[64px]
            ${isActive ? 'text-accent' : 'text-muted'}
          `}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
