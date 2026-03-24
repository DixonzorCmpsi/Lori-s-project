import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      navigate('/login');
      return;
    }

    if (!isAuthenticated) {
      // Store token and redirect to login
      sessionStorage.setItem('pendingInviteToken', token);
      navigate('/login');
      return;
    }

    // Authenticated — join the production
    setJoining(true);
    apiClient<{ production_id: string; role: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(data => {
        toast('Joined production!', 'success');
        navigate(`/production/${data.production_id}`);
      })
      .catch(err => {
        toast(err.message || 'Failed to join', 'error');
        navigate('/');
      });
  }, [token, isAuthenticated, isLoading, navigate, toast]);

  if (joining) {
    return (
      <div className="text-center">
        <p className="text-muted">Joining production...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-muted">Redirecting...</p>
    </div>
  );
}
