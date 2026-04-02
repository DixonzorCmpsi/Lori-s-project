import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/hooks/useApi';
import { apiClient, ApiRequestError } from '@/services/api';
import type { Theater } from '@/types';

export function NewProductionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: theaters } = useApi<Theater[]>(() => apiClient('/theaters'));

  const [name, setName] = useState('');
  const [castSize, setCastSize] = useState('30');
  const [firstRehearsal, setFirstRehearsal] = useState('');
  const [openingNight, setOpeningNight] = useState('');
  const [closingNight, setClosingNight] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const theaterId = theaters?.[0]?.id;

  if (!theaterId) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="mb-4">Create Production</h1>
        <p className="text-muted mb-4">You need to add a theater first.</p>
        <Button onClick={() => navigate('/theater/new')}>Add Theater</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    try {
      const prod = await apiClient<{ id: string }>('/productions', {
        method: 'POST',
        body: JSON.stringify({
          theater_id: theaterId,
          name,
          estimated_cast_size: parseInt(castSize),
          first_rehearsal: firstRehearsal,
          opening_night: openingNight,
          closing_night: closingNight,
        }),
      });
      toast('Production created!', 'success');
      navigate(`/production/${prod.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409) {
          toast('You already have an active production. Redirecting...', 'warning');
          const prodId = err.detail?.production_id;
          if (prodId) {
            navigate(`/production/${prodId}`);
          } else {
            navigate('/');
          }
        } else if (err.fields) {
          const fe: Record<string, string> = {};
          err.fields.forEach(f => fe[f.field] = f.message);
          setErrors(fe);
        } else {
          toast(err.message, 'error');
        }
      }
    } finally { setIsLoading(false); }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-md mx-auto">
      <h1 className="mb-6">Create Production</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Production Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} required placeholder="Into the Woods" maxLength={200} />
        <Input label="Estimated Cast Size" type="number" value={castSize} onChange={e => setCastSize(e.target.value)} min="1" max="200" required />
        <Input label="First Rehearsal" type="date" value={firstRehearsal} onChange={e => setFirstRehearsal(e.target.value)} min={today} error={errors.first_rehearsal} required />
        <Input label="Opening Night" type="date" value={openingNight} onChange={e => setOpeningNight(e.target.value)} min={firstRehearsal || today} error={errors.opening_night} required />
        <Input label="Closing Night" type="date" value={closingNight} onChange={e => setClosingNight(e.target.value)} min={openingNight || today} error={errors.closing_night} required />
        <Button type="submit" isLoading={isLoading} className="w-full">Create Production</Button>
      </form>
    </div>
  );
}
