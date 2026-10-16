import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCalls, callLabel } from '@/hooks/useCalls';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, Panel, Pill, MiniButton, Empty } from '@/components/ui/page';
import {
  listScenes, createScene, updateScene, deleteScene, addSceneCast, updateSceneCast, removeSceneCast,
  getSceneAvailability, type Scene, type SceneAvailability,
} from '@/services/scenes';
import { ApiRequestError } from '@/services/api';
import { PageGuide } from '@/components/PageGuide';
import { PageTour } from '@/tours/PageTour';
import { scenesTourSteps } from '@/tours/pageTours';

const STATUS_TONE = { green: 'good', yellow: 'warn', red: 'bad' } as const;
const STATUS_LABEL = { green: 'All available', yellow: 'Some away', red: 'Many away' } as const;

export function ScenesPage() {
  usePageTitle('Scenes');
  const { id } = useParams<{ id: string }>();
  const { userRole, members } = useProduction();
  const isStaff = userRole === 'director' || userRole === 'staff';
  const { toast } = useToast();
  const scenes = useApi(() => listScenes(id!), [id]);
  const { calls, defaultCall } = useCalls(isStaff ? id : undefined);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [checkDate, setCheckDate] = useState('');
  const [deleting, setDeleting] = useState<Scene | null>(null);
  const dateId = checkDate || defaultCall?.id || '';
  const availability = useApi<SceneAvailability[]>(
    isStaff && dateId ? () => getSceneAvailability(id!, dateId) : () => Promise.resolve([]),
    [id, dateId, scenes.data?.length, scenes.data?.reduce((n, s) => n + s.cast.length, 0)],
  );
  const availabilityById = useMemo(() => new Map((availability.data ?? []).map(a => [a.scene_id, a])), [availability.data]);
  const castMembers = members.filter(m => m.role === 'cast');

  async function run(fn: () => Promise<unknown>, success?: string) {
    try { await fn(); if (success) toast(success); scenes.refetch(); }
    catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error'); }
  }

  async function add() {
    if (!name.trim()) { toast('Give the scene a name', 'warning'); return; }
    setAdding(true);
    await run(async () => {
      await createScene(id!, { name: name.trim(), description: description.trim() || undefined, order_index: (scenes.data?.length ?? 0) + 1 });
      setName(''); setDescription('');
    }, 'Scene added');
    setAdding(false);
  }

  return (
    <div>
      {isStaff && <PageTour tourId="page-scenes" steps={scenesTourSteps} />}
      <PageHeader
        title="Scenes"
        subtitle={isStaff ? 'Break the show into scenes, cast them, and see who is free for each call.' : 'Who is in which scene.'}
      />

      <PageGuide page="scenes" />

      {isStaff && (
        <div className="grid gap-4 lg:grid-cols-2 mb-5">
          <div data-tour="scenes-add"><Panel title="Add a scene">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Scene" value={name} maxLength={200} onChange={e => setName(e.target.value)} placeholder="Act 1, Scene 2" onKeyDown={e => e.key === 'Enter' && add()} />
              <Input label="Description (optional)" value={description} maxLength={500} onChange={e => setDescription(e.target.value)} placeholder="The market" />
            </div>
            <div className="mt-3"><Button size="sm" onClick={add} isLoading={adding}>Add scene</Button></div>
          </Panel></div>
          <div data-tour="scenes-free"><Panel title="Who is free?">
            {calls.length === 0 ? <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>Add dates to the schedule to check availability.</p> : (
              <>
                <Select label="Check scenes against" value={dateId} onChange={e => setCheckDate(e.target.value)}>
                  {calls.map(c => <option key={c.id} value={c.id}>{callLabel(c)}</option>)}
                </Select>
                <p className="mt-2 text-xs" style={{ color: 'var(--t-subtle-text)' }}>Each scene below shows whether its cast submitted a conflict for that date.</p>
              </>
            )}
          </Panel></div>
        </div>
      )}

      {scenes.isLoading ? <Skeleton className="h-40 w-full" /> : !scenes.data || scenes.data.length === 0 ? (
        <Empty title="No scenes yet">{isStaff ? 'Add your first scene above.' : 'Your director has not added scenes yet.'}</Empty>
      ) : (
        <div data-tour="scenes-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenes.data.map(scene => (
            <SceneCard key={scene.id} scene={scene} isStaff={isStaff} availability={availabilityById.get(scene.id)}
              candidates={castMembers.filter(m => !scene.cast.some(c => c.user_id === m.user_id))}
              onRename={n => run(() => updateScene(id!, scene.id, { name: n }), 'Scene renamed')}
              onAdd={(uid, character) => run(() => addSceneCast(id!, scene.id, { user_id: uid, character_name: character || undefined }), 'Added to scene')}
              onCharacter={(uid, character) => run(() => updateSceneCast(id!, scene.id, uid, character))}
              onRemove={uid => run(() => removeSceneCast(id!, scene.id, uid))}
              onDelete={() => setDeleting(scene)} />
          ))}
        </div>
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name}”?`} confirmLabel="Delete" confirmVariant="destructive"
        onConfirm={async () => { const s = deleting!; setDeleting(null); await run(() => deleteScene(id!, s.id), 'Scene deleted'); }}>
        The scene and its casting are removed. Schedules and calls are not affected.
      </Dialog>
    </div>
  );
}

function SceneCard({ scene, isStaff, availability, candidates, onRename, onAdd, onCharacter, onRemove, onDelete }: {
  scene: Scene; isStaff: boolean; availability?: SceneAvailability;
  candidates: { user_id: string; name?: string }[];
  onRename: (n: string) => void; onAdd: (uid: string, character: string) => void;
  onCharacter: (uid: string, character: string) => void; onRemove: (uid: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(scene.name);
  const [who, setWho] = useState('');
  const [character, setCharacter] = useState('');
  const away = new Map((availability?.conflicts ?? []).map(c => [c.user_id, c.reason]));

  return (
    <Panel>
      <div className="flex items-start justify-between gap-2 mb-2">
        {editing ? (
          <div className="flex flex-1 gap-2">
            <Input aria-label="Scene name" value={title} onChange={e => setTitle(e.target.value)} />
            <Button size="sm" onClick={() => { onRename(title); setEditing(false); }}>Save</Button>
          </div>
        ) : (
          <h2 className="text-base font-semibold leading-snug" style={{ color: 'var(--t-subtle-text-bright)' }}>{scene.name}</h2>
        )}
        {isStaff && (
          <div className="flex gap-1 shrink-0">
            <MiniButton onClick={() => setEditing(e => !e)}>{editing ? 'Cancel' : 'Rename'}</MiniButton>
            <MiniButton tone="bad" onClick={onDelete}>Delete</MiniButton>
          </div>
        )}
      </div>
      {scene.description && <p className="text-xs mb-2" style={{ color: 'var(--t-subtle-text)' }}>{scene.description}</p>}
      {isStaff && availability && (
        <div className="mb-3 flex items-center gap-2">
          <Pill tone={STATUS_TONE[availability.status]}>{STATUS_LABEL[availability.status]}</Pill>
          {availability.conflicts.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>{availability.conflicts.length} of {availability.total_cast} away</span>
          )}
        </div>
      )}
      {scene.cast.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>No one cast yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {scene.cast.map(c => (
            <li key={c.user_id} className={`grid items-center gap-2 text-sm ${isStaff ? 'grid-cols-[minmax(0,1fr)_8.5rem_auto]' : 'grid-cols-1'}`} style={{ color: 'var(--t-subtle-text-bright)' }}>
              <span className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium truncate">{c.name}</span>
                {away.has(c.user_id) && <Pill tone="bad" title={away.get(c.user_id) ?? undefined}>Away</Pill>}
                {!isStaff && c.character_name && <span className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>as {c.character_name}</span>}
              </span>
              {isStaff && (
                <input
                  aria-label={`Character for ${c.name}`}
                  defaultValue={c.character_name ?? ''}
                  placeholder="Character"
                  onBlur={e => e.target.value !== (c.character_name ?? '') && onCharacter(c.user_id, e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded text-xs bg-transparent"
                  style={{ border: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}
                />
              )}
              {isStaff && <MiniButton onClick={() => onRemove(c.user_id)} title={`Remove ${c.name}`}>Remove</MiniButton>}
            </li>
          ))}
        </ul>
      )}
      {isStaff && candidates.length > 0 && (
        <div className="mt-3 pt-3 grid gap-2" style={{ borderTop: '1px solid var(--t-section-border)' }}>
          <Select aria-label="Add cast member" value={who} onChange={e => setWho(e.target.value)}>
            <option value="">Add a cast member…</option>
            {candidates.map(m => <option key={m.user_id} value={m.user_id}>{m.name ?? 'Member'}</option>)}
          </Select>
          {who && (
            <div className="flex gap-2">
              <Input aria-label="Character name" value={character} onChange={e => setCharacter(e.target.value)} placeholder="Character (optional)" />
              <Button size="sm" onClick={() => { onAdd(who, character); setWho(''); setCharacter(''); }}>Add</Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
