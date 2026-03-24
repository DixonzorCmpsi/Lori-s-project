import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { ApiRequestError } from '@/services/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      const inviteToken = sessionStorage.getItem('pendingInviteToken');
      if (inviteToken) {
        sessionStorage.removeItem('pendingInviteToken');
        navigate(`/join?token=${inviteToken}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) {
          setError('Too many login attempts. Please try again later.');
        } else if (err.message.toLowerCase().includes('locked')) {
          setError('Your account is locked. Check your email or try again in 30 minutes.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 text-center">Sign In</h2>

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-4">
        <GoogleSignInButton text="signin_with" />
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-2 text-muted">or sign in with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          Sign In
        </Button>
      </form>

      <div className="mt-4 text-center space-y-2">
        <Link to="/forgot-password" className="text-sm text-accent hover:underline">
          Forgot your password?
        </Link>
        <p className="text-sm text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
