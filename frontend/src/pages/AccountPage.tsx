import { useState, useEffect } from 'react';
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
import { AvatarPicker, AvatarDisplay } from '@/components/ui/AvatarPicker';

interface EmergencyContact {
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

const RELATIONSHIPS = ['Parent', 'Guardian', 'Spouse', 'Sibling', 'Other'];
const emptyContact = (): EmergencyContact => ({ name: '', email: '', phone: '', relationship: 'Parent' });

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

  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar_url || 'initials');
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([emptyContact(), emptyContact()]);
  const [savingContacts, setSavingContacts] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  useEffect(() => {
    apiClient<{ name: string; email: string; phone: string; relationship: string }[]>('/auth/emergency-contacts')
      .then(data => {
        if (data.length > 0) {
          const loaded = data.map(c => ({ name: c.name, email: c.email || '', phone: c.phone || '', relationship: c.relationship }));
          while (loaded.length < 2) loaded.push(emptyContact());
          setContacts(loaded);
        }
        setContactsLoaded(true);
      })
      .catch(() => setContactsLoaded(true));
  }, []);

  const [dob, setDob] = useState('');
  const [savingDob, setSavingDob] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isMinor = user?.age_range === '13-17';
  const profileIncomplete = !user?.age_range;

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

  async function handleAvatarSave(id: string) {
    setSelectedAvatar(id);
    setSavingAvatar(true);
    try {
      const avatarValue = id === 'initials' ? null : id;
      await apiClient('/auth/account', { method: 'PATCH', body: JSON.stringify({ avatar_url: avatarValue }) });
      setUser({ ...user!, avatar_url: avatarValue || undefined });
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingAvatar(false);
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

  async function handleContactsSave() {
    const valid = contacts.filter(c => c.name.trim());
    if (valid.length === 0) { toast('At least one emergency contact is required', 'error'); return; }
    if (!valid[0].email && !valid[0].phone) { toast('First contact needs email or phone', 'error'); return; }
    setSavingContacts(true);
    try {
      await apiClient('/auth/emergency-contacts', {
        method: 'PUT', body: JSON.stringify({ contacts: valid }),
      });
      if (isMinor) {
        await apiClient('/auth/account', { method: 'PATCH', body: JSON.stringify({ parental_consent: true }) });
        setUser({ ...user!, parental_consent: true });
      }
      toast('Emergency contacts saved');
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingContacts(false);
    }
  }

  function updateContact(idx: number, field: keyof EmergencyContact, value: string) {
    setContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  async function handleDobSave() {
    if (!dob) return;
    setSavingDob(true);
    try {
      const result = await apiClient<{ age_range: string }>('/auth/complete-profile', {
        method: 'POST', body: JSON.stringify({ date_of_birth: dob }),
      });
      setUser({ ...user!, age_range: result.age_range });
      toast('Age verified');
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSavingDob(false);
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

      {/* Incomplete profile banner */}
      {profileIncomplete && (
        <div className="rounded-sm p-4 mb-6"
          style={{ background: 'rgba(255,180,50,0.08)', border: '1px solid rgba(255,180,50,0.2)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,220,100,0.9)' }}>
            Complete your profile
          </p>
          <p className="text-xs" style={{ color: 'var(--t-subtle-text-bright)' }}>
            Your date of birth is required for age verification. Please provide it below.
          </p>
        </div>
      )}

      {/* Profile */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Profile</p>
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={nameError} />
        <Input label="Email" value={user?.email || ''} disabled className="opacity-60" />
        {user?.age_range ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Age Range:</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
              background: isMinor ? 'rgba(255,180,50,0.1)' : 'rgba(100,200,100,0.1)',
              color: isMinor ? 'rgba(255,200,80,0.8)' : 'rgba(100,220,100,0.8)',
            }}>
              {user.age_range}
            </span>
          </div>
        ) : (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--t-section-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,200,80,0.8)' }}>Date of Birth (required)</p>
            <p className="text-[10px]" style={{ color: 'var(--t-subtle-text)' }}>
              We only store your age range (13-17 or 18+), never your exact birthday.
            </p>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="px-3 py-2 rounded-sm text-sm outline-none w-full"
              style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}
            />
            <Button size="sm" onClick={handleDobSave} isLoading={savingDob} disabled={!dob}>
              Verify Age
            </Button>
          </div>
        )}
        <Button onClick={handleNameSave} isLoading={savingName} disabled={name === user?.name}>Save Name</Button>
      </section>

      {/* Avatar */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Avatar</p>
          <AvatarDisplay avatarId={selectedAvatar} name={user?.name} size="lg" />
        </div>
        <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
          Choose an icon or keep your initials as your avatar.
        </p>
        <AvatarPicker
          selected={selectedAvatar}
          name={user?.name}
          onSelect={handleAvatarSave}
        />
        {savingAvatar && <p className="text-[10px]" style={{ color: 'var(--t-subtle-text)' }}>Saving...</p>}
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

      {/* Emergency Contacts */}
      <section className="rounded-sm p-5 mb-6 space-y-4"
        style={{
          background: isMinor ? 'rgba(255,180,50,0.04)' : 'var(--t-subtle-bg)',
          border: `1px solid ${isMinor ? 'rgba(255,180,50,0.15)' : 'var(--t-section-border)'}`,
        }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: isMinor ? 'rgba(255,200,80,0.7)' : 'var(--t-subtle-text)' }}>
            Emergency Contacts
          </p>
          {isMinor && !user?.parental_consent && (
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,80,80,0.1)', color: 'rgba(255,120,120,0.8)' }}>Required</span>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
          {isMinor
            ? 'COPPA requires at least one emergency contact on file. Please provide a parent or guardian.'
            : 'Add an emergency contact so your production team can reach someone if needed.'}
        </p>
        {contacts.map((c, idx) => (
          <div key={idx} className="space-y-2 pt-3" style={{ borderTop: idx > 0 ? '1px solid var(--t-section-border)' : 'none' }}>
            <p className="text-[10px] font-bold" style={{ color: 'var(--t-subtle-text)' }}>
              Contact {idx + 1} {idx === 0 ? '(required)' : '(optional)'}
            </p>
            <Input label="Full Name" value={c.name} onChange={e => updateContact(idx, 'name', e.target.value)}
              placeholder={idx === 0 ? 'Required' : 'Optional'} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input label="Email" type="email" value={c.email} onChange={e => updateContact(idx, 'email', e.target.value)} placeholder="email@example.com" />
              <Input label="Phone" type="tel" value={c.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-subtle-text-bright)' }}>Relationship</label>
              <div className="flex flex-wrap gap-1.5">
                {RELATIONSHIPS.map(r => (
                  <button key={r} onClick={() => updateContact(idx, 'relationship', r)}
                    className="text-[10px] px-2.5 py-1 rounded cursor-pointer"
                    style={{
                      background: c.relationship === r ? 'rgba(212,175,55,0.15)' : 'var(--t-subtle-bg)',
                      color: c.relationship === r ? 'hsl(43,60%,55%)' : 'var(--t-subtle-text)',
                      border: `1px solid ${c.relationship === r ? 'rgba(212,175,55,0.2)' : 'var(--t-section-border)'}`,
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {user?.parental_consent && isMinor && (
          <p className="text-[10px]" style={{ color: 'rgba(100,220,100,0.7)' }}>Parental consent recorded.</p>
        )}
        <Button size="sm" onClick={handleContactsSave} isLoading={savingContacts}
          disabled={!contacts[0].name.trim()}>
          Save Emergency Contacts
        </Button>
      </section>

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
