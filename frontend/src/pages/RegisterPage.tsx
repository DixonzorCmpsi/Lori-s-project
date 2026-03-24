import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { register } from '@/services/auth';
import { ApiRequestError } from '@/services/api';
import { validateEmail, validatePassword, validateName, validateDOB } from '@/utils/validation';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(name); if (nameErr) errs.name = nameErr;
    const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr;
    const dobErr = validateDOB(dob); if (dobErr) errs.dob = dobErr;
    const pwErr = validatePassword(password); if (pwErr) errs.password = pwErr;
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    try {
      await register({ name, email, password, date_of_birth: dob });
      toast('Account created! Check your email to verify.', 'success');
      navigate('/verify-email?pending=true');
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) {
        const fieldErrors: Record<string, string> = {};
        for (const f of err.fields) fieldErrors[f.field] = f.message;
        setErrors(fieldErrors);
      } else if (err instanceof ApiRequestError) {
        toast(err.message, 'error');
      } else {
        toast('Something went wrong.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 text-center">Create Account</h2>

      <div className="mb-4">
        <GoogleSignInButton text="signup_with" />
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-2 text-muted">or register with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} required />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} required />
        <Input label="Date of Birth" type="date" value={dob} onChange={e => setDob(e.target.value)}
          onBlur={() => { const err = validateDOB(dob); setErrors(p => err ? {...p, dob: err} : (({dob: _, ...r}) => r)(p)); }}
          error={errors.dob} required max={new Date().toISOString().split('T')[0]} />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} required autoComplete="new-password" />
        <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.confirm} required autoComplete="new-password" />

        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" required className="mt-1 accent-accent" />
          <span>I agree to the <a href="#" className="text-accent hover:underline">Privacy Policy</a></span>
        </label>

        <Button type="submit" isLoading={isLoading} className="w-full">Create Account</Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
