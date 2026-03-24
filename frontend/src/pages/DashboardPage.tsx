import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/utils/format';
import type { Production, Theater } from '@/types';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: theaters, isLoading: theatersLoading } = useApi<Theater[]>(
    () => apiClient('/theaters')
  );
  const { data: productions, isLoading: prodsLoading } = useApi<Production[]>(
    () => apiClient('/productions')
  );

  if (theatersLoading || prodsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const hasTheater = theaters && theaters.length > 0;
  const hasProductions = productions && productions.length > 0;

  if (!hasTheater) {
    return (
      <EmptyState
        title="Welcome to Digital Call Board"
        description="Start by adding your theater or school."
        action={{ label: 'Add Theater', onClick: () => navigate('/theater/new') }}
      />
    );
  }

  if (!hasProductions) {
    return (
      <EmptyState
        title="No Productions Yet"
        description="Create your first production to get started."
        action={{ label: 'Create Production', onClick: () => navigate('/production/new') }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Your Productions</h1>
        <Button onClick={() => navigate('/production/new')}>New Production</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {productions.map(prod => (
          <button
            key={prod.id}
            onClick={() => navigate(`/production/${prod.id}`)}
            className="bg-surface border border-border rounded-lg p-5 text-left hover:border-accent/50 transition-colors"
          >
            <h3 className="font-heading text-lg text-accent mb-1">{prod.name}</h3>
            <p className="text-sm text-muted mb-3">
              {prod.estimated_cast_size} cast &middot; Opens {formatDate(prod.opening_night)}
            </p>
            {prod.is_archived && (
              <span className="text-xs bg-muted/20 text-muted px-2 py-1 rounded">Archived</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
