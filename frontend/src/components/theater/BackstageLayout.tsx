import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { apiClient } from '@/services/api';
import { TheaterLayout } from './TheaterLayout';
import { Chalkboard } from './Chalkboard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Production, Member } from '@/types';
import { createContext, useContext } from 'react';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

interface ProductionContextType {
  production: Production | null;
  members: Member[];
  userRole: string | null;
  refetch: () => void;
}

const ProductionContext = createContext<ProductionContextType>({
  production: null, members: [], userRole: null, refetch: () => {},
});

export function useProduction() {
  return useContext(ProductionContext);
}

export function BackstageLayout() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const noop = () => Promise.resolve(null as any);
  const { data: production, refetch } = useApi<Production>(
    id ? () => apiClient(`/productions/${id}`) : noop, [id]
  );

  const { data: members } = useApi<Member[]>(
    id ? () => apiClient(`/productions/${id}/members`) : noop, [id]
  );

  const currentUser = members?.find(m => m.user_id === user?.id);
  const userRole = currentUser?.role || null;
  const isDirectorOrStaff = userRole === 'director' || userRole === 'staff';

  const basePath = id ? `/production/${id}` : '';

  // Director/Staff nav items
  const directorNav = [
    { icon: '◈', label: 'Dashboard', path: basePath || '/' },
    { icon: '◷', label: 'Schedule', path: `${basePath}/schedule` },
    { icon: '◻', label: 'Bulletin', path: `${basePath}/bulletin` },
    { icon: '◉', label: 'Members', path: `${basePath}/roster` },
    { icon: '◆', label: 'Chat', path: `${basePath}/chat` },
    { icon: '◎', label: 'Settings', path: `${basePath}/settings` },
  ];

  // Cast nav — simplified
  const castNav = [
    { icon: '◻', label: 'Bulletin', path: `${basePath}/bulletin` },
    { icon: '◷', label: 'Schedule', path: `${basePath}/schedule` },
    { icon: '◆', label: 'Chat', path: `${basePath}/chat` },
  ];

  const navItems = isDirectorOrStaff ? directorNav : (id ? castNav : [
    { icon: '◈', label: 'Dashboard', path: '/' },
  ]);

  const panelStyle = {
    background: 'rgba(12, 10, 9, 0.75)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  };

  // Left Panel — navigation controls
  const leftPanel = (
    <div className="h-full flex flex-col pt-14 pb-4 px-3 overflow-y-auto relative"
      style={panelStyle}>

      {/* Production name */}
      {production && (
        <motion.div
          className="mb-6 px-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'hsl(38, 40%, 45%)' }}>
            Production
          </p>
          <h3 className="text-sm font-semibold truncate" style={{
            fontFamily: '"Playfair Display", serif',
            color: 'hsl(35, 20%, 85%)',
          }}>
            {production.name}
          </h3>
        </motion.div>
      )}

      {/* Nav buttons */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && item.path !== basePath && location.pathname.startsWith(item.path));
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 cursor-pointer group"
              style={{
                background: isActive ? 'rgba(255, 180, 80, 0.08)' : 'transparent',
                color: isActive ? 'hsl(38, 70%, 60%)' : 'hsl(25, 10%, 50%)',
              }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.3 + i * 0.05 }}
              whileHover={{ x: 2, background: 'rgba(255, 180, 80, 0.05)' }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-xs opacity-60">{item.icon}</span>
              <span className="text-xs font-medium tracking-wide">{item.label}</span>
              {isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                  style={{ background: 'hsl(38, 70%, 55%)' }}
                  layoutId="nav-indicator"
                  transition={spring}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {!id && (
          <motion.button
            onClick={() => navigate('/production/new')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors"
            style={{ color: 'hsl(38, 60%, 55%)' }}
            whileHover={{ background: 'rgba(255, 180, 80, 0.06)' }}
          >
            <span>+</span>
            <span className="font-medium">New Production</span>
          </motion.button>
        )}
        <motion.button
          onClick={() => navigate('/account')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors"
          style={{ color: 'hsl(25, 10%, 45%)' }}
          whileHover={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <span className="text-xs opacity-60">◇</span>
          <span className="truncate">{user?.name || 'Account'}</span>
        </motion.button>
        <motion.button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors"
          style={{ color: 'hsl(0, 40%, 55%)' }}
          whileHover={{ background: 'rgba(220, 50, 50, 0.06)' }}
        >
          <span className="text-xs opacity-60">⏻</span>
          <span>Sign Out</span>
        </motion.button>
      </div>
    </div>
  );

  // Right Panel — cast/member list
  const rightPanel = (
    <div className="h-full flex flex-col pt-14 pb-4 px-3 overflow-y-auto relative"
      style={{ ...panelStyle, borderRight: 'none', borderLeft: '1px solid rgba(255, 255, 255, 0.06)' }}>

      <motion.div
        className="mb-4 px-2"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring, delay: 0.3 }}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: 'hsl(38, 40%, 45%)' }}>
          {id ? 'Cast & Crew' : 'Quick Actions'}
        </p>
      </motion.div>

      {id && members ? (
        <div className="flex flex-col gap-1">
          {members.map((member, i) => (
            <motion.div
              key={member.id}
              className="flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group cursor-default"
              style={{ background: 'transparent' }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.4 + i * 0.03 }}
              whileHover={{ background: 'rgba(255, 255, 255, 0.03)' }}
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background: member.role === 'director'
                    ? 'linear-gradient(135deg, hsl(38, 60%, 35%), hsl(38, 50%, 25%))'
                    : member.role === 'staff'
                    ? 'linear-gradient(135deg, hsl(200, 40%, 30%), hsl(200, 35%, 22%))'
                    : 'linear-gradient(135deg, hsl(25, 20%, 20%), hsl(25, 15%, 15%))',
                  color: member.role === 'director' ? 'hsl(38, 70%, 70%)' : 'hsl(25, 10%, 60%)',
                }}>
                {(member.name || member.user_id).charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: 'hsl(35, 15%, 75%)' }}>
                  {member.name || `Member`}
                </p>
                <p className="text-[10px] capitalize" style={{
                  color: member.role === 'director' ? 'hsl(38, 60%, 55%)' :
                         member.role === 'staff' ? 'hsl(200, 40%, 55%)' :
                         'hsl(25, 10%, 42%)',
                }}>
                  {member.role}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : !id ? (
        <div className="flex flex-col gap-2 px-2">
          {['Add Theater', 'New Production'].map((action, i) => (
            <motion.button
              key={action}
              className="text-xs text-left px-3 py-2 rounded-lg cursor-pointer transition-colors"
              style={{ color: 'hsl(25, 10%, 50%)' }}
              whileHover={{ background: 'rgba(255, 180, 80, 0.06)', color: 'hsl(38, 60%, 60%)' }}
              onClick={() => navigate(i === 0 ? '/theater/new' : '/production/new')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              {action}
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="px-2">
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      )}
    </div>
  );

  // Top bar — glass style matching login
  const topBar = (
    <div className="flex items-center justify-between px-5 py-2.5 relative"
      style={{
        background: 'rgba(12, 10, 9, 0.75)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
      <h2 className="text-xs font-medium tracking-wide" style={{ color: 'hsl(38, 50%, 55%)', fontFamily: '"Playfair Display", serif' }}>
        Digital Call Board
      </h2>
      <p className="text-[10px] tracking-widest uppercase" style={{ color: 'hsl(25, 10%, 38%)' }}>
        {production?.name || 'Backstage'}
      </p>
    </div>
  );

  return (
    <ProductionContext.Provider value={{ production, members: members || [], userRole, refetch }}>
      <TheaterLayout
        curtainsOpen={true}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        topBar={topBar}
      >
        {/* Center stage — chalkboard nailed to the middle */}
        <div className="w-full h-full pt-20 pb-36 px-6 flex items-start justify-center overflow-y-auto">
          <Chalkboard className="w-full max-w-4xl mt-2">
            <div className="p-6 min-h-[400px]">
              <Outlet />
            </div>
          </Chalkboard>
        </div>
      </TheaterLayout>
    </ProductionContext.Provider>
  );
}
