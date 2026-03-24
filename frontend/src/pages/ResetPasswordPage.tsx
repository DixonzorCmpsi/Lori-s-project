import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { resetPassword } from '@/services/auth';
import { ApiRequestError } from '@/services/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      toast('Password reset! You can now sign in.', 'success');
      navigate('/login');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    } finally { setIsLoading(false); }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Invalid Link</h2>
        <p className="text-muted mb-4">This reset link is invalid or has expired.</p>
        <Link to="/forgot-password" className="text-accent hover:underline">Request a new one</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 text-center">Set New Password</h2>
      {error && <div className="bg-destructive/10 border border-destructive rounded-md px-4 py-3 mb-4 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
        <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        <Button type="submit" isLoading={isLoading} className="w-full">Reset Password</Button>
      </form>
    </div>
  );
}
