import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { register } from '@/services/auth';
import { ApiRequestError } from '@/services/api';
import { validateEmail, validatePassword, validateName, validateDOB } from '@/utils/validation';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { TheaterLayout } from '@/components/theater/TheaterLayout';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.4 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring },
};

const inputClasses = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200';
const inputStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'hsl(35, 20%, 88%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'rgba(255, 180, 80, 0.3)';
  e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 3px rgba(255, 180, 80, 0.06)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02)';
};

export function RegisterPage() {
  usePageTitle('Create Account');
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

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <motion.div variants={fadeUp}>
      <label className="block text-xs font-medium mb-1.5 tracking-wide uppercase"
        style={{ color: 'hsl(25, 10%, 50%)' }}>{label}</label>
      {children}
      {error && <p className="text-xs mt-1 font-medium" style={{ color: 'hsl(0, 65%, 65%)' }}>{error}</p>}
    </motion.div>
  );

  return (
    <TheaterLayout curtainsOpen={false}>
      <motion.div
        className="w-full flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={spring}
      >
        <div className="flex w-full max-w-[820px] min-h-[520px] overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(12, 10, 9, 0.85)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Left — branding */}
          <motion.div
            className="hidden md:flex flex-col justify-between w-[300px] flex-shrink-0 p-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, hsl(350, 45%, 16%) 0%, hsl(350, 40%, 10%) 50%, hsl(25, 20%, 8%) 100%)',
              borderRight: '1px solid rgba(255, 180, 80, 0.08)',
            }}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...spring, delay: 0.2 }}
          >
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,0.3) 28px, rgba(255,255,255,0.3) 29px)',
              }}
            />
            <div className="relative z-10">
              <h1 className="text-[1.75rem] leading-[1.1] font-bold tracking-tight"
                style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(38, 75%, 62%)' }}>
                Join the<br />Production
              </h1>
              <div className="w-10 h-[2px] mt-3 mb-3 rounded-full"
                style={{ background: 'linear-gradient(90deg, hsl(38, 70%, 50%), transparent)' }}
              />
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(25, 15%, 55%)', maxWidth: '22ch' }}>
                One place for directors, staff, and cast. Less time managing, more time creating.
              </p>
            </div>
            <p className="relative z-10 text-xs leading-relaxed" style={{ color: 'hsl(25, 10%, 38%)', maxWidth: '24ch' }}>
              The art should be the focus. We handle the rest.
            </p>
            <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,180,80,0.05) 0%, transparent 70%)', filter: 'blur(25px)' }}
            />
          </motion.div>

          {/* Right — form */}
          <motion.div
            className="flex-1 p-8 md:p-9 overflow-y-auto max-h-[85vh]"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.h2 variants={fadeUp}
              className="text-lg font-semibold tracking-tight mb-1"
              style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(35, 20%, 88%)' }}>
              Create your account
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm mb-6" style={{ color: 'hsl(25, 10%, 50%)' }}>
              Fill in the details below to get started
            </motion.p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Full Name" error={errors.name}>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name"
                  className={inputClasses} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className={inputClasses} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>
              <Field label="Date of Birth" error={errors.dob}>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} required
                  max={new Date().toISOString().split('T')[0]}
                  className={inputClasses} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Password" error={errors.password}>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    autoComplete="new-password" placeholder="Min 8 chars"
                    className={inputClasses} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </Field>
                <Field label="Confirm" error={errors.confirm}>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    autoComplete="new-password" placeholder="Repeat"
                    className={inputClasses} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                </Field>
              </div>

              <motion.label variants={fadeUp} className="flex items-start gap-2 text-xs cursor-pointer"
                style={{ color: 'hsl(25, 10%, 50%)' }}>
                <input type="checkbox" required className="mt-0.5 rounded"
                  style={{ accentColor: 'hsl(38, 70%, 50%)' }} />
                <span>I agree to the <a href="#" className="underline" style={{ color: 'hsl(38, 60%, 55%)' }}>Privacy Policy</a></span>
              </motion.label>

              <motion.div variants={fadeUp}>
                <motion.button
                  type="submit" disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, hsl(38, 70%, 50%) 0%, hsl(32, 65%, 42%) 100%)',
                    color: 'hsl(25, 20%, 8%)',
                    boxShadow: '0 4px 16px rgba(200, 140, 40, 0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                  whileHover={{ scale: 1.01, boxShadow: '0 6px 24px rgba(200, 140, 40, 0.3)' }}
                  whileTap={{ scale: 0.98, y: 1 }}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </motion.button>
              </motion.div>
            </form>

            <motion.div variants={fadeUp} className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-xs" style={{ background: 'rgb(12, 10, 9)', color: 'hsl(25, 10%, 40%)' }}>
                  or sign up with
                </span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <GoogleSignInButton text="signup_with" />
            </motion.div>

            <motion.p variants={fadeUp} className="mt-5 text-center text-sm" style={{ color: 'hsl(25, 10%, 45%)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-medium transition-colors duration-200 hover:text-[hsl(38,70%,60%)]"
                style={{ color: 'hsl(38, 60%, 55%)' }}>Sign in</Link>
            </motion.p>
          </motion.div>
        </div>
      </motion.div>
    </TheaterLayout>
  );
}
