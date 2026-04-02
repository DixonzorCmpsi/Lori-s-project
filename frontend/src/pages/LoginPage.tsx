import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { TheaterLayout } from '@/components/theater/TheaterLayout';
import { ApiRequestError } from '@/services/api';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.6 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

export function LoginPage() {
  usePageTitle('Sign In');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If already logged in, skip login page entirely
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSuccess = () => {
    setCurtainsOpen(true);
    setTimeout(() => {
      const inviteToken = sessionStorage.getItem('pendingInviteToken');
      if (inviteToken) {
        sessionStorage.removeItem('pendingInviteToken');
        navigate(`/join?token=${inviteToken}`);
      } else {
        navigate('/');
      }
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      handleSuccess();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) setError('Too many attempts. Please wait a moment.');
        else if (err.message.toLowerCase().includes('locked'))
          setError('Account locked. Check your email or wait 30 minutes.');
        else setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const inputClasses = 'w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200';
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

  return (
    <TheaterLayout curtainsOpen={curtainsOpen}>
      <AnimatePresence mode="wait">
        {!curtainsOpen ? (
          <motion.div
            key="login"
            className="w-full flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring}
          >
            {/* Split layout — centered on stage */}
            <div className="flex w-full max-w-[820px] min-h-[480px] overflow-hidden rounded-2xl"
              style={{
                background: 'rgba(12, 10, 9, 0.85)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              {/* Left — branding panel */}
              <motion.div
                className="hidden md:flex flex-col justify-between w-[340px] flex-shrink-0 p-8 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, hsl(350, 45%, 16%) 0%, hsl(350, 40%, 10%) 50%, hsl(25, 20%, 8%) 100%)',
                  borderRight: '1px solid rgba(255, 180, 80, 0.08)',
                }}
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ ...spring, delay: 0.2 }}
              >
                {/* Subtle curtain texture */}
                <div className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,0.3) 28px, rgba(255,255,255,0.3) 29px)',
                  }}
                />
                <div className="relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.4 }}
                  >
                    <h1
                      className="text-[2rem] leading-[1.1] font-bold tracking-tight"
                      style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(38, 75%, 62%)' }}
                    >
                      Digital<br />Call Board
                    </h1>
                    <div className="w-12 h-[2px] mt-4 mb-4 rounded-full"
                      style={{ background: 'linear-gradient(90deg, hsl(38, 70%, 50%), transparent)' }}
                    />
                    <p className="text-sm leading-relaxed" style={{ color: 'hsl(25, 15%, 55%)', maxWidth: '24ch' }}>
                      Management shouldn't be the hardest part of production. We bring directors, staff, and cast into one backstage hub so the art stays the focus.
                    </p>
                  </motion.div>
                </div>
                <motion.p
                  className="relative z-10 text-xs leading-relaxed"
                  style={{ color: 'hsl(25, 10%, 38%)', maxWidth: '26ch' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  Schedules, conflicts, communication — handled. You focus on the show.
                </motion.p>
                {/* Spotlight glow */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(255,180,80,0.06) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                  }}
                />
              </motion.div>

              {/* Right — form panel */}
              <motion.div
                className="flex-1 flex flex-col justify-center p-8 md:p-10"
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <motion.h2
                  variants={fadeUp}
                  className="text-xl font-semibold tracking-tight mb-1"
                  style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(35, 20%, 88%)' }}
                >
                  Welcome back
                </motion.h2>
                <motion.p variants={fadeUp} className="text-sm mb-7" style={{ color: 'hsl(25, 10%, 50%)' }}>
                  Sign in to access your productions
                </motion.p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg px-4 py-3 mb-5 text-sm"
                    style={{
                      background: 'rgba(220, 50, 50, 0.08)',
                      border: '1px solid rgba(220, 50, 50, 0.15)',
                      color: 'hsl(0, 65%, 65%)',
                    }}
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
                  <motion.div variants={fadeUp}>
                    <label htmlFor="login-email" className="block text-xs font-medium mb-2 tracking-wide uppercase"
                      style={{ color: 'hsl(25, 10%, 50%)' }}>Email Address</label>
                    <input
                      id="login-email"
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required autoComplete="username"
                      className={inputClasses} style={inputStyle}
                      onFocus={handleFocus} onBlur={handleBlur}
                    />
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <label htmlFor="login-password" className="block text-xs font-medium mb-2 tracking-wide uppercase"
                      style={{ color: 'hsl(25, 10%, 50%)' }}>Password</label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password" required autoComplete="current-password"
                        className={inputClasses} style={{ ...inputStyle, paddingRight: '3rem' }}
                        onFocus={handleFocus} onBlur={handleBlur}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs cursor-pointer select-none"
                        style={{ color: 'hsl(25, 10%, 50%)' }}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </motion.div>

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
                      whileHover={{ scale: 1.01, boxShadow: '0 6px 24px rgba(200, 140, 40, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
                      whileTap={{ scale: 0.98, y: 1 }}
                    >
                      {isLoading ? 'Signing in...' : 'Access Dashboard'}
                    </motion.button>
                  </motion.div>
                </form>

                <motion.div variants={fadeUp} className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 text-xs" style={{ background: 'rgb(12, 10, 9)', color: 'hsl(25, 10%, 40%)' }}>
                      or continue with
                    </span>
                  </div>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <GoogleSignInButton text="signin_with" />
                </motion.div>

                <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between text-sm">
                  <Link to="/forgot-password" className="transition-colors duration-200 hover:text-[hsl(38,70%,55%)]"
                    style={{ color: 'hsl(25, 10%, 45%)' }}>
                    Forgot?
                  </Link>
                  <Link to="/register" className="font-medium transition-colors duration-200 hover:text-[hsl(38,70%,60%)]"
                    style={{ color: 'hsl(38, 60%, 55%)' }}>
                    Join the Cast
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="welcome"
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
          >
            <h2
              className="text-4xl font-bold tracking-tight"
              style={{
                fontFamily: '"Playfair Display", serif',
                color: 'hsl(38, 75%, 62%)',
                textShadow: '0 4px 40px rgba(255, 180, 50, 0.25)',
              }}
            >
              Welcome Backstage
            </h2>
            <motion.div
              className="w-16 h-[2px] mx-auto mt-4 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, hsl(38, 70%, 50%), transparent)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3, ...spring }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </TheaterLayout>
  );
}
