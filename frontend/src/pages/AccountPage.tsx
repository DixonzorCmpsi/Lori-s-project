import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/services/api';
import { deleteAccount } from '@/services/auth';
import { validateName, validatePassword } from '@/utils/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';

export function AccountPage() {
  usePageTitle('Account');
  const { user, logout, setUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleNameSave() {
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    setNameError('');
    setSavingName(true);
    try {
      const updated = await apiClient<{ name: string }>('/auth/account', {
        method: 'PATCH', body: JSON.stringify({ name: name.trim() }),
      });
      setUser({ ...user!, name: updated.name });
      toast('Name updated');
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function handlePasswordChange() {
    setPwError('');
    if (!currentPw) { setPwError('Current password is required'); return; }
    const pwErr = validatePassword(newPw);
    if (pwErr) { setPwError(pwErr); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }

    setSavingPw(true);
    try {
      await apiClient('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      toast('Password changed');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      toast('Account deleted');
      await logout();
      navigate('/login');
    } catch (e: any) {
      toast(e.message || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Account Settings</h1>

      <section className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={nameError}
        />
        <Input
          label="Email"
          value={user?.email || ''}
          disabled
          className="opacity-60"
        />
        <Button onClick={handleNameSave} isLoading={savingName} disabled={name === user?.name}>
          Save Name
        </Button>
      </section>

      <section className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
        <Input
          label="Current Password"
          type="password"
          value={currentPw}
          onChange={e => setCurrentPw(e.target.value)}
        />
        <Input
          label="New Password"
          type="password"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
        />
        {pwError && <p className="text-sm text-destructive">{pwError}</p>}
        <Button onClick={handlePasswordChange} isLoading={savingPw}>
          Change Password
        </Button>
      </section>

      <section className="border border-destructive/30 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-destructive mb-3">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground font-medium">Delete Account</p>
            <p className="text-xs text-muted">Permanently delete your account and all data.</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
        </div>
      </section>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Account"
        confirmLabel="Delete Account"
        confirmVariant="destructive"
        onConfirm={handleDeleteAccount}
        isLoading={deleting}
      >
        <p>This will permanently delete your account, remove you from all productions, and erase all your data. This cannot be undone.</p>
      </Dialog>
    </div>
  );
}
