import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { apiClient, ApiRequestError } from '@/services/api';

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
      await apiClient('/theaters', {
        method: 'POST',
        body: JSON.stringify({ name, city, state }),
      });
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
        } else {
          toast(err.message, 'error');
        }
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-6">Add Your Theater</h1>
      <p className="text-muted mb-6">Tell us about your venue.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Theater / School Name" value={name} onChange={e => setName(e.target.value)} error={errors.name} required maxLength={200} placeholder="Lincoln High School" />
        <Input label="City" value={city} onChange={e => setCity(e.target.value)} error={errors.city} required maxLength={100} placeholder="Springfield" />
        <Input label="State" value={state} onChange={e => setState(e.target.value)} error={errors.state} required maxLength={100} placeholder="Illinois" />
        <Button type="submit" isLoading={isLoading} className="w-full">Create Theater</Button>
      </form>
    </div>
  );
}
