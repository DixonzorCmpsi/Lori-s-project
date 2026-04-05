import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiClient, ApiRequestError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/utils/format';
import type { Production, Theater } from '@/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function DashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const { data: theaters, isLoading: theatersLoading } = useApi<Theater[]>(
    () => apiClient('/theaters')
  );
  const { data: productions, isLoading: prodsLoading, error: prodsError } = useApi<Production[]>(
    () => apiClient('/productions')
  );

  const sortedProductions = useMemo(() => {
    if (!productions) return [];
    let recents: Record<string, number> = {};
    try {
      const raw = window.localStorage.getItem('callboard.productionRecents');
      recents = raw ? JSON.parse(raw) : {};
    } catch {
      recents = {};
    }
    return productions
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const ta = recents[a.p.id] || 0;
        const tb = recents[b.p.id] || 0;
        if (tb !== ta) return tb - ta;
        return a.idx - b.idx;
      })
      .map(({ p }) => p);
  }, [productions]);

  if (theatersLoading || prodsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  // Handle profile-incomplete error from productions API
  if (prodsError && prodsError instanceof ApiRequestError && prodsError.status === 403) {
    return (
      <EmptyState
        title="Complete Your Profile"
        description="Please complete your profile to view your productions."
        action={{ label: 'Go to Account', onClick: () => navigate('/account') }}
      />
    );
  }

  const hasTheater = theaters && theaters.length > 0;
  const hasProductions = productions && productions.length > 0;

  // No theater AND no productions — brand new user, prompt to create a theater
  if (!hasTheater && !hasProductions) {
    return (
      <EmptyState
        title="Welcome to Digital Call Board"
        description="Start by adding your theater or school, or join a production via an invite link."
        action={{ label: 'Add Theater', onClick: () => navigate('/theater/new') }}
      />
    );
  }

  // Has a theater but no productions yet
  if (hasTheater && !hasProductions) {
    return (
      <EmptyState
        title="No Productions Yet"
        description="Create your first production to get started."
        action={{ label: 'Create Production', onClick: () => navigate('/production/new') }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-8 sm:mb-16 border-b border-white/5 pb-6 sm:pb-8">
        <div className="max-w-xl">
          <h1 className="text-4xl md:text-6xl font-bold font-heading text-foreground mb-4 tracking-tighter leading-[0.9]">
            Current <span className="text-accent">Productions</span>
          </h1>
          <p className="text-muted text-lg font-light max-w-[45ch]">
            Manage your active theater productions, schedules, and cast conflicts from a centralized backstage hub.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/production/new')} className="md:mb-1 shadow-accent/20">
          Initialize Production
        </Button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {sortedProductions.map((prod, idx) => (
          <motion.button
            key={prod.id}
            variants={item}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/production/${prod.id}`)}
            className={`
              group relative liquid-glass p-6 text-left transition-all duration-500
              ${idx % 4 === 0 ? 'md:col-span-2 md:row-span-1' : ''}
              ${idx % 7 === 0 ? 'lg:col-span-2' : ''}
            `}
          >
            <div className="flex flex-col h-full justify-between gap-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/60">
                    Prod-ID: {prod.id.slice(0, 8)}
                  </span>
                  {prod.is_archived ? (
                    <span className="text-[10px] bg-muted/10 text-muted border border-muted/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-medium">Archived</span>
                  ) : (
                    <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-medium">Production Active</span>
                  )}
                </div>
                <h3 className="font-heading text-2xl text-foreground group-hover:text-accent transition-colors leading-tight mb-2">
                  {prod.name}
                </h3>
                <div className="flex flex-wrap gap-4 mt-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Cast Size</p>
                    <p className="font-mono text-lg text-foreground/80">{prod.estimated_cast_size}</p>
                  </div>
                  <div className="w-px h-8 bg-white/5 mx-2" />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Opening Night</p>
                    <p className="font-mono text-lg text-foreground/80">{formatDate(prod.opening_night)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-6">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-background bg-surface-raised flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-linear-to-br from-accent/20 to-accent/5" />
                    </div>
                  ))}
                  <div className="w-7 h-7 rounded-full border-2 border-background bg-surface-raised flex items-center justify-center text-[10px] text-muted">
                    +
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-accent font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  Open Board →
                </span>
              </div>
            </div>
          </motion.button>
        ))}

        {/* Action card for creating new production */}
        <motion.button
          variants={item}
          onClick={() => navigate('/production/new')}
          className="group relative border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:border-accent/40 hover:bg-accent/5 transition-all min-h-[220px]"
        >
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform bg-white/5">
            <span className="text-2xl text-muted group-hover:text-accent">+</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-muted group-hover:text-accent font-medium">New Production</p>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
