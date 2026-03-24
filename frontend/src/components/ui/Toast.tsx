import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const colors = {
    success: 'bg-success/20 border-success text-success',
    error: 'bg-destructive/20 border-destructive text-destructive',
    warning: 'bg-warning/20 border-warning text-warning',
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-md border text-sm animate-[slideIn_0.2s_ease-out] ${colors[t.type]}`}
            role="alert"
          >
            <div className="flex justify-between items-start gap-2">
              <span>{t.message}</span>
              <button onClick={() => removeToast(t.id)} className="text-current opacity-60 hover:opacity-100">
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
