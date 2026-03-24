import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';

// Google's client ID — loaded from env or hardcoded for now
const GOOGLE_CLIENT_ID = '690356966597-jj0c5likb5ssd647r58kq0nnsjd06vtt.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
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
      const result = await apiClient<{
        access_token: string;
        age_range: string | null;
      }>('/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({
          google_id: payload.sub,
          email: payload.email,
          name: payload.name,
        }),
      });

      setToken(result.access_token);

      // Fetch full user profile
      const me = await apiClient<any>('/auth/me');
      setUser(me);

      // If age_range is null, user needs to complete profile
      if (!result.age_range) {
        navigate('/complete-profile');
      } else {
        const inviteToken = sessionStorage.getItem('pendingInviteToken');
        if (inviteToken) {
          sessionStorage.removeItem('pendingInviteToken');
          navigate(`/join?token=${inviteToken}`);
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      toast(err.message || 'Google sign-in failed', 'error');
    }
  }, [setToken, setUser, navigate, toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google && buttonRef.current) {
        clearInterval(interval);
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text,
        });
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
