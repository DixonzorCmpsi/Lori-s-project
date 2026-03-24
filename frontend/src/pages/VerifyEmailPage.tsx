import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '@/services/auth';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      setStatus('verifying');
      verifyEmail(token)
        .then(() => { setStatus('success'); setMessage('Email verified! You can now sign in.'); })
        .catch(err => { setStatus('error'); setMessage(err.message || 'Verification failed'); });
    }
  }, [token]);

  if (token) {
    return (
      <div className="text-center">
        {status === 'verifying' && <p className="text-muted">Verifying your email...</p>}
        {status === 'success' && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-success">Email Verified!</h2>
            <p className="text-muted mb-6">{message}</p>
            <Link to="/login" className="text-accent hover:underline">Sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-destructive">Verification Failed</h2>
            <p className="text-muted mb-6">{message}</p>
            <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold mb-4">Check Your Email</h2>
      <p className="text-muted mb-6">We've sent a verification link to your email. Click it to activate your account.</p>
      <Link to="/login" className="text-accent hover:underline text-sm">Back to sign in</Link>
    </div>
  );
}
