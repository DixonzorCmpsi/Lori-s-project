import { Outlet, useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useApi } from '@/hooks/useApi';
import { apiClient } from '@/services/api';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Production, Member } from '@/types';
import { createContext, useContext } from 'react';

interface ProductionContextType {
  production: Production | null;
  members: Member[];
  userRole: string | null;
}

const ProductionContext = createContext<ProductionContextType>({
  production: null, members: [], userRole: null,
});

export function useProduction() {
  return useContext(ProductionContext);
}

export function ProductionLayout() {
  const { id } = useParams<{ id: string }>();

  const { data: production, isLoading: prodLoading } = useApi<Production>(
    () => apiClient(`/productions/${id}`), [id]
  );

  const { data: members } = useApi<Member[]>(
    () => apiClient(`/productions/${id}/members`), [id]
  );

  if (prodLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden lg:block w-64 bg-surface border-r border-border p-5">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const basePath = `/production/${id}`;
  const navItems = [
    { label: 'Dashboard', path: basePath },
    { label: 'Schedule', path: `${basePath}/schedule` },
    { label: 'Bulletin Board', path: `${basePath}/bulletin` },
    { label: 'Members', path: `${basePath}/roster` },
    { label: 'Chat', path: `${basePath}/chat` },
    { label: 'Settings', path: `${basePath}/settings` },
  ];

  const mobileItems = [
    { label: 'Bulletin', path: `${basePath}/bulletin` },
    { label: 'Schedule', path: `${basePath}/schedule` },
    { label: 'Chat', path: `${basePath}/chat` },
  ];

  return (
    <ProductionContext.Provider value={{
      production,
      members: members || [],
      userRole: null, // TODO: derive from members
    }}>
      <div className="flex min-h-screen">
        <Sidebar title={production?.name || 'Production'} items={navItems} />
        <main className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8 max-w-5xl mx-auto w-full">
          <Outlet />
        </main>
        <MobileNav items={mobileItems} />
      </div>
    </ProductionContext.Provider>
  );
}
