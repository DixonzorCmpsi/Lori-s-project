import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';

// Google's client ID — loaded from env

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
        };
      };
    };
  }
}

interface GoogleCredentialResponse {
  credential: string; // JWT ID token
}

function decodeJwtPayload(token: string): any {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

interface Props {
  text?: 'signin_with' | 'signup_with';
}

export function GoogleSignInButton({ text = 'signin_with' }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCredentialResponse = useCallback(async (response: GoogleCredentialResponse) => {
    try {
      const payload = decodeJwtPayload(response.credential);

      // Call backend directly with fetch (not apiClient) to avoid stale token issues
      const res = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_id: payload.sub,
          email: payload.email,
          name: payload.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Google sign-in failed' }));
        toast(err.message || 'Google sign-in failed', 'error');
        return;
      }

      const result = await res.json();
      setToken(result.access_token);

      // Small delay to ensure localStorage is written before next API call
      await new Promise(r => setTimeout(r, 100));

      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${result.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        setUser(me);
      }

      const inviteToken = sessionStorage.getItem('pendingInviteToken');
      if (inviteToken) {
        sessionStorage.removeItem('pendingInviteToken');
        navigate(`/join?token=${inviteToken}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      toast(err.message || 'Google sign-in failed', 'error');
    }
  }, [setToken, setUser, navigate, toast]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID is missing in environment variables.');
      return;
    }
    
    const interval = setInterval(() => {
      if (window.google && buttonRef.current) {
        clearInterval(interval);
        
        try {
          // Initialize for the current session
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: true,
          });

          // Also show One Tap prompt for returning users
          window.google.accounts.id.prompt?.();
          
          // Render the button
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text,
            shape: 'rectangular',
            logo_alignment: 'left',
          });
        } catch (err) {
          console.warn('Google GSI initialization warning:', err);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [handleCredentialResponse, text]);

  return (
    <div>
      <div ref={buttonRef} className="flex justify-center" />
      <noscript>
        <p className="text-sm text-muted text-center">Google Sign-In requires JavaScript</p>
      </noscript>
    </div>
  );
}
