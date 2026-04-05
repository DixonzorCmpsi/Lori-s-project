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
import { ChalkText } from '@/components/theater/Chalkboard';

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

  const [emailNotifs, setEmailNotifs] = useState(user?.email_notifications ?? true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [parentEmail, setParentEmail] = useState(user?.parent_email || '');
  const [savingParent, setSavingParent] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isMinor = user?.age_range === '13-17';

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
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleEmailPrefSave() {
    setSavingPrefs(true);
    try {
      await apiClient('/auth/account', {
        method: 'PATCH', body: JSON.stringify({ email_notifications: emailNotifs }),
      });
      setUser({ ...user!, email_notifications: emailNotifs });
      toast('Email preferences updated');
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleParentEmailSave() {
    setSavingParent(true);
    try {
      await apiClient('/auth/account', {
        method: 'PATCH', body: JSON.stringify({ parent_email: parentEmail.trim(), parental_consent: true }),
      });
      setUser({ ...user!, parent_email: parentEmail.trim(), parental_consent: true });
      toast('Parent/guardian email saved');
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingParent(false);
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
    <div className="max-w-2xl mx-auto">
      <ChalkText size="lg">Account Settings</ChalkText>
      <div className="h-4" />

      {/* Profile */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Profile</p>
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={nameError} />
        <Input label="Email" value={user?.email || ''} disabled className="opacity-60" />
        {user?.age_range && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Age Range:</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
              background: isMinor ? 'rgba(255,180,50,0.1)' : 'rgba(100,200,100,0.1)',
              color: isMinor ? 'rgba(255,200,80,0.8)' : 'rgba(100,220,100,0.8)',
            }}>
              {user.age_range}
            </span>
          </div>
        )}
        <Button onClick={handleNameSave} isLoading={savingName} disabled={name === user?.name}>Save Name</Button>
      </section>

      {/* Email Notifications */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Notifications</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>Email Notifications</p>
            <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
              Receive emails for announcements, team messages, and conflict reminders.
            </p>
          </div>
          <button
            onClick={() => setEmailNotifs(!emailNotifs)}
            className="w-10 h-6 rounded-full cursor-pointer transition-colors relative flex-shrink-0"
            style={{ background: emailNotifs ? 'hsl(43, 74%, 49%)' : 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}
          >
            <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
              style={{ left: emailNotifs ? '20px' : '2px', background: emailNotifs ? '#1a1a1a' : 'var(--t-subtle-text)' }}
            />
          </button>
        </div>
        {emailNotifs !== (user?.email_notifications ?? true) && (
          <Button size="sm" onClick={handleEmailPrefSave} isLoading={savingPrefs}>Save Preference</Button>
        )}
      </section>

      {/* Parental Consent — minors only */}
      {isMinor && (
        <section className="rounded-sm p-5 mb-6 space-y-4"
          style={{ background: 'rgba(255,180,50,0.04)', border: '1px solid rgba(255,180,50,0.15)' }}>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'rgba(255,200,80,0.7)' }}>
            Parent / Guardian Consent
          </p>
          <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
            Since you're under 18, we need a parent or guardian's email address on file. This is required by COPPA regulations.
          </p>
          <Input label="Parent/Guardian Email" type="email" value={parentEmail}
            onChange={e => setParentEmail(e.target.value)} placeholder="parent@email.com" />
          {user?.parental_consent && (
            <p className="text-[10px]" style={{ color: 'rgba(100,220,100,0.7)' }}>Parental consent recorded.</p>
          )}
          <Button size="sm" onClick={handleParentEmailSave} isLoading={savingParent}
            disabled={!parentEmail.trim() || parentEmail === (user?.parent_email || '')}>
            {user?.parental_consent ? 'Update' : 'Save & Confirm Consent'}
          </Button>
        </section>
      )}

      {/* Change Password */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Change Password</p>
        <Input label="Current Password" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
        <Input label="New Password" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
        <Input label="Confirm New Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        {pwError && <p className="text-sm text-destructive">{pwError}</p>}
        <Button onClick={handlePasswordChange} isLoading={savingPw}>Change Password</Button>
      </section>

      {/* Danger Zone */}
      <section className="rounded-sm p-5"
        style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.2)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgba(255,120,120,0.8)' }}>Danger Zone</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>Delete Account</p>
            <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Permanently delete your account and all data.</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
        </div>
      </section>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Account"
        confirmLabel="Delete Account" confirmVariant="destructive" onConfirm={handleDeleteAccount} isLoading={deleting}>
        <p>This will permanently delete your account, remove you from all productions, and erase all your data. This cannot be undone.</p>
      </Dialog>
    </div>
  );
}
