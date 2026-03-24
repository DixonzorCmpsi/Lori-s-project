import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { forgotPassword } from '@/services/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await forgotPassword(email);
    } catch { /* Anti-enumeration: always show success */ }
    setSent(true);
    setIsLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Check Your Email</h2>
        <p className="text-muted mb-6">If an account exists for {email}, we've sent a password reset link.</p>
        <Link to="/login" className="text-accent hover:underline text-sm">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2 text-center">Forgot Password</h2>
      <p className="text-muted text-sm mb-6 text-center">Enter your email and we'll send a reset link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Button type="submit" isLoading={isLoading} className="w-full">Send Reset Link</Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
