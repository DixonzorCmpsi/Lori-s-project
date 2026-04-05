import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/Toast';

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [productionName, setProductionName] = useState('');

  // Fetch production name from the invite token
  useEffect(() => {
    if (!token) return;
    apiClient<{ production_name?: string }>(`/join?token=${encodeURIComponent(token)}`)
      .then(data => {
        if (data.production_name) setProductionName(data.production_name);
      })
      .catch(() => {
        // Token might be invalid — will be handled when they try to join
      });
  }, [token]);

  // If authenticated, join immediately
  useEffect(() => {
    if (isLoading || !token || !isAuthenticated) return;

    setJoining(true);
    apiClient<{ production_id: string; role: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(data => {
        toast('Joined production!', 'success');
        // Cast members go to conflict submission first, staff/director go to dashboard
        if (data.role === 'cast') {
          navigate(`/production/${data.production_id}/conflicts`);
        } else {
          navigate(`/production/${data.production_id}`);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to join');
        setJoining(false);
      });
  }, [token, isAuthenticated, isLoading, navigate, toast]);

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Invite</h1>
        <p className="text-muted mb-6">This invite link is missing a token.</p>
        <Link to="/login" className="text-accent hover:underline">Go to login</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-muted">Joining production...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-2xl font-bold text-foreground mb-4">Could not join</h1>
        <p className="text-destructive mb-6">{error}</p>
        <Link to="/login" className="text-accent hover:underline">Go to login</Link>
      </div>
    );
  }

  // Not authenticated — store token and show invite landing
  sessionStorage.setItem('pendingInviteToken', token);

  return (
    <div className="max-w-md mx-auto text-center py-16 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(38, 75%, 62%)' }}
      >
        You're Invited!
      </h1>
      <p className="text-muted mb-8">
        {productionName
          ? <>You've been invited to join <strong style={{ color: 'hsl(35, 20%, 80%)' }}>{productionName}</strong> on The Call Board. Sign in or create an account to get started.</>
          : <>You've been invited to join a production on The Call Board. Sign in or create an account to get started.</>
        }
      </p>

      <div className="space-y-3">
        <Link
          to="/login"
          className="block w-full py-3 rounded-xl font-semibold text-sm tracking-wide text-center"
          style={{
            background: 'linear-gradient(135deg, hsl(38, 70%, 50%) 0%, hsl(32, 65%, 42%) 100%)',
            color: 'hsl(25, 20%, 8%)',
            boxShadow: '0 4px 16px rgba(200, 140, 40, 0.2)',
          }}
        >
          Sign In
        </Link>

        <Link
          to="/register"
          className="block w-full py-3 rounded-xl font-semibold text-sm tracking-wide text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'hsl(35, 20%, 75%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          Create Account
        </Link>
      </div>

      <p className="text-xs text-muted mt-6">
        After signing in, you'll automatically join the production.
      </p>
    </div>
  );
}
