import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TheaterLayout } from '@/components/theater/TheaterLayout';

export function NotFoundPage() {
  usePageTitle('Page Not Found');
  return (
    <TheaterLayout curtainsOpen={true}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h1 className="font-heading text-6xl text-accent mb-4">404</h1>
        <p className="text-xl text-white/80 mb-2">This stage is empty</p>
        <p className="text-white/50 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-accent/90 transition-colors"
        >
          Back to the Lobby
        </Link>
      </div>
    </TheaterLayout>
  );
}
