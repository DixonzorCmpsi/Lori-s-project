import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from '@/hooks/useForm';
import { useToast } from '@/components/ui/Toast';
import { createProfile, uploadHeadshot, deleteHeadshot } from '@/services/cast-profile';
import { MAX_LENGTHS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ProfileForm extends Record<string, unknown> {
  display_name: string;
  phone: string;
  role_character: string;
}

function validate(v: ProfileForm) {
  const e: Partial<Record<keyof ProfileForm, string>> = {};
  if (!v.display_name.trim()) e.display_name = 'Display name is required';
  if (v.display_name.length > MAX_LENGTHS.display_name) e.display_name = `Max ${MAX_LENGTHS.display_name} chars`;
  if (v.phone.length > MAX_LENGTHS.phone) e.phone = `Max ${MAX_LENGTHS.phone} chars`;
  if (v.role_character.length > MAX_LENGTHS.role_character) e.role_character = `Max ${MAX_LENGTHS.role_character} chars`;
  return e;
}

export function CastProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { values, errors, touched, isSubmitting, setValue, handleBlur, handleSubmit } =
    useForm<ProfileForm>({ display_name: '', phone: '', role_character: '' }, validate);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearFile() {
    setSelectedFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onSubmit(v: ProfileForm) {
    if (!id) return;
    try {
      await createProfile(id, {
        display_name: v.display_name.trim(),
        phone: v.phone.trim() || undefined,
        role_character: v.role_character.trim() || undefined,
      });

      if (selectedFile) {
        setUploading(true);
        await uploadHeadshot(id, selectedFile);
        setUploading(false);
      }

      toast('Profile created');
      navigate(`/production/${id}/conflicts`);
    } catch (err: any) {
      toast(err.message || 'Failed to create profile', 'error');
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-foreground mb-6">Cast Profile</h1>

      <form onSubmit={e => { e.preventDefault(); handleSubmit(onSubmit); }} className="space-y-4">
        <Input
          label="Display Name *"
          value={values.display_name}
          onChange={e => setValue('display_name', e.target.value)}
          onBlur={() => handleBlur('display_name')}
          error={touched.display_name ? errors.display_name : undefined}
          maxLength={MAX_LENGTHS.display_name}
        />

        <Input
          label="Phone (optional)"
          value={values.phone}
          onChange={e => setValue('phone', e.target.value)}
          onBlur={() => handleBlur('phone')}
          error={touched.phone ? errors.phone : undefined}
          maxLength={MAX_LENGTHS.phone}
          type="tel"
        />

        <Input
          label="Role / Character (optional)"
          value={values.role_character}
          onChange={e => setValue('role_character', e.target.value)}
          onBlur={() => handleBlur('role_character')}
          error={touched.role_character ? errors.role_character : undefined}
          maxLength={MAX_LENGTHS.role_character}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Headshot</label>
          <div className="flex items-center gap-4">
            {preview && (
              <img src={preview} alt="Headshot preview" className="w-20 h-20 rounded-full object-cover border border-border" />
            )}
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-muted" />
              {preview && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFile}>Remove</Button>
              )}
            </div>
          </div>
        </div>

        <Button type="submit" isLoading={isSubmitting || uploading}>
          Save Profile
        </Button>
      </form>
    </div>
  );
}
