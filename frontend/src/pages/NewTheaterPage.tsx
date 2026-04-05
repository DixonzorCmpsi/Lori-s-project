import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { apiClient, ApiRequestError } from '@/services/api';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';

export function NewTheaterPage() {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    try {
      await apiClient('/theaters', { method: 'POST', body: JSON.stringify({ name, city, state }) });
      toast('Theater created!', 'success');
      navigate('/production/new');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.fields) {
          const fe: Record<string, string> = {};
          err.fields.forEach(f => fe[f.field] = f.message);
          setErrors(fe);
        } else if (err.status === 409) {
          toast('You already have a theater. Redirecting...', 'warning');
          navigate('/');
        } else { toast(err.message, 'error'); }
      }
    } finally { setIsLoading(false); }
  };

  const inputStyle = "w-full px-3 py-2 rounded text-sm border outline-none";
  const inputCss = { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)' };

  return (
    <div className="flex flex-col items-center pt-8">
      <button onClick={() => navigate('/')} className="self-start mb-4 text-[10px] cursor-pointer flex items-center gap-1"
        style={{ color: 'var(--t-chalk-text)' }}>
        &larr; <span>Back to Dashboard</span>
      </button>
      <ChalkText size="lg" className="mb-6">Add Your Theater</ChalkText>

      <StickyNote color="white" rotate={-0.5} className="w-full max-w-sm">
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">Venue Details</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium mb-1 opacity-70">Theater / School Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required maxLength={200}
              placeholder="Lincoln High School" className={inputStyle} style={inputCss} />
            {errors.name && <p className="text-[10px] mt-1" style={{ color: 'hsl(0,60%,45%)' }}>{errors.name}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1 opacity-70">City</label>
            <input value={city} onChange={e => setCity(e.target.value)} required maxLength={100}
              placeholder="Springfield" className={inputStyle} style={inputCss} />
            {errors.city && <p className="text-[10px] mt-1" style={{ color: 'hsl(0,60%,45%)' }}>{errors.city}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1 opacity-70">State</label>
            <input value={state} onChange={e => setState(e.target.value)} required maxLength={100}
              placeholder="Illinois" className={inputStyle} style={inputCss} />
            {errors.state && <p className="text-[10px] mt-1" style={{ color: 'hsl(0,60%,45%)' }}>{errors.state}</p>}
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full py-2 rounded text-sm font-bold uppercase tracking-wider cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.08)', opacity: isLoading ? 0.5 : 1 }}>
            {isLoading ? 'Creating...' : 'Create Theater'}
          </button>
        </form>
      </StickyNote>
    </div>
  );
}
