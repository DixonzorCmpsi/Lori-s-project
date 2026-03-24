import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl text-accent mb-2">Digital Call Board</h1>
          <p className="text-muted text-sm">Theater Production Management</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
