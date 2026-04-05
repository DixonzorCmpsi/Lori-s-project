import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { AuthContext } from '@/contexts/AuthContext';

// Mock hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn();
const mockAuthContext = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  login: mockLogin,
  logout: vi.fn(),
  setUser: vi.fn(),
  setToken: vi.fn(),
};

// Mock components that might cause issues
vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => <div data-testid="google-button">Google Button</div>,
}));

vi.mock('@/components/theater/TheaterLayout', () => ({
  TheaterLayout: ({ children }: any) => <div data-testid="theater-layout">{children}</div>,
}));

// Mock framer-motion to avoid 'undefined' component errors in test env
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <LoginPage />
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  it('renders email and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument();
  });

  it('renders "Sign in with Google" button', () => {
    renderLoginPage();
    expect(screen.getByTestId('google-button')).toBeInTheDocument();
  });

  it('submits email and password on form submit', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' });
    const submitButton = screen.getByRole('button', { name: /access dashboard/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('disables submit button while loading', async () => {
    let resolveLogin: (value: any) => void = () => {};
    mockLogin.mockImplementation(() => new Promise(resolve => { resolveLogin = resolve; }));
    
    renderLoginPage();
    const submitButton = screen.getByRole('button', { name: /access dashboard/i });
    const form = screen.getByTestId('login-form');
    
    fireEvent.submit(form);

    // Check if the button is disabled (wait for it as it's a state change)
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    resolveLogin(null);
    // After resolve, the form is unmounted because curtainsOpen becomes true
    await waitFor(() => {
      expect(screen.getByText(/welcome backstage/i)).toBeInTheDocument();
    });
  });

  it('shows "Forgot?" link', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: /forgot\?/i })).toBeInTheDocument();
  });

  it('navigates to registration page', () => {
    renderLoginPage();
    const registerLink = screen.getByRole('link', { name: /join the cast/i });
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('password field is type="password"', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toHaveAttribute('type', 'password');
  });
});
