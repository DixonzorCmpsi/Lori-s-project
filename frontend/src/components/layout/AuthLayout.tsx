import { Outlet } from 'react-router-dom';
import { TheaterLayout } from '@/components/theater/TheaterLayout';

export function AuthLayout() {
  return (
    <TheaterLayout curtainsOpen={true}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl mb-2" style={{ color: 'hsl(43, 74%, 49%)', fontFamily: '"Playfair Display", serif' }}>
              Digital Call Board
            </h1>
            <p className="text-sm" style={{ color: 'hsl(25, 8%, 48%)' }}>Theater Production Management</p>
          </div>
          <div className="rounded-lg p-6" style={{
            background: 'rgba(20, 18, 16, 0.85)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            backdropFilter: 'blur(8px)',
          }}>
            <Outlet />
          </div>
        </div>
      </div>
    </TheaterLayout>
  );
}
