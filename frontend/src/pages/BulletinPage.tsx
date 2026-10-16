import { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { acknowledgePost, getAckStatus, remindPending, type AckStatus } from '@/services/acks';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getPosts, createPost, updatePost, deletePost, pinPost } from '@/services/bulletin';
import { formatRelativeTime } from '@/utils/format';
import { MAX_LENGTHS } from '@/utils/constants';
import { Dialog } from '@/components/ui/Dialog';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';
import type { BulletinPost } from '@/types';
import { motion } from 'framer-motion';
import { PageTour } from '@/tours/PageTour';
import { bulletinTourSteps, bulletinCastTourSteps } from '@/tours/pageTours';
import { PageGuide } from '@/components/PageGuide';

function isStaff(role: string | null) {
  return role === 'director' || role === 'staff';
}

const noteColorCycle: Array<'yellow' | 'pink' | 'blue' | 'white' | 'green'> = ['yellow', 'white', 'pink', 'blue', 'green'];
const rotations = [-1.5, 0.8, -0.5, 1.2, -1, 0.6, -0.8, 1.5];

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const fadeIn = { hidden: { opacity: 0, scale: 0.95, y: 8 }, show: { opacity: 1, scale: 1, y: 0, transition: spring } };

export function BulletinPage() {
  usePageTitle('Bulletin Board');
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { userRole, members } = useProduction();
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const canEdit = isStaff(userRole);

  const { data: posts, isLoading, refetch } = useApi(() => getPosts(id!), [id]);
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<BulletinPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notifyMembers, setNotifyMembers] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [ackFor, setAckFor] = useState<BulletinPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [posts]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const target = search.get('post');
    if (target) setHighlightPostId(target);
  }, [location.search]);

  useEffect(() => {
    if (!highlightPostId || sorted.length === 0) return;
    const el = document.getElementById(`post-${highlightPostId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightPostId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [highlightPostId, sorted.length]);

  function authorName(authorId: string) {
    return members.find(m => m.user_id === authorId)?.name || 'Director';
  }

  function openEdit(post: BulletinPost) {
    setEditPost(post); setTitle(post.title); setBody(post.body); setShowForm(true);
  }

  function openNew() {
    setEditPost(null); setTitle(''); setBody(''); setNotifyMembers(false); setRequireAck(false); setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (editPost) {
        await updatePost(id!, editPost.id, { title, body }); toast('Post updated');
      } else {
        await createPost(id!, { title, body, notify_members: notifyMembers, requires_ack: requireAck });
        toast(notifyMembers ? 'Post created — members notified' : 'Post created');
      }
      setShowForm(false); setEditPost(null); refetch();
    } catch { toast('Failed to save post', 'error'); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setBusy(true);
    try { await deletePost(id!, deleteId); toast('Post deleted'); setDeleteId(null); refetch(); }
    catch { toast('Failed to delete', 'error'); }
    finally { setBusy(false); }
  }

  async function handlePin(postId: string) {
    setBusy(true);
    try { await pinPost(id!, postId); toast('Pin toggled'); refetch(); }
    catch { toast('Failed to pin', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {userRole && <PageTour tourId={`page-bulletin-${canEdit ? 'staff' : 'cast'}`} steps={canEdit ? bulletinTourSteps : bulletinCastTourSteps} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <ChalkText size="lg">Bulletin Board</ChalkText>
        {canEdit && !showForm && (
          <button data-tour="bulletin-new-post" onClick={openNew}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
            style={{ background: 'rgb(var(--c-255-220-100) / 0.1)', color: 'rgb(var(--c-255-220-100) / 0.8)', border: '1px solid rgb(var(--c-255-220-100) / 0.15)' }}>
            New Post
          </button>
        )}
      </div>

      <PageGuide page="bulletin" />

      {/* New/Edit form — appears as a white note */}
      {showForm && (
        <div className="mb-6">
          <StickyNote color="white" rotate={0}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">
              {editPost ? 'Edit Post' : 'New Announcement'}
            </p>
            <div className="space-y-2">
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={MAX_LENGTHS.post_title}
                placeholder="Title" className="w-full px-2 py-1.5 rounded text-sm border outline-none"
                style={{ borderColor: 'rgb(var(--c-0-0-0) / 0.1)', background: 'rgb(var(--c-0-0-0) / 0.02)' }} />
              <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={MAX_LENGTHS.post_body}
                placeholder="Write your announcement..." rows={4}
                className="w-full px-2 py-1.5 rounded text-sm border outline-none resize-none"
                style={{ borderColor: 'rgb(var(--c-0-0-0) / 0.1)', background: 'rgb(var(--c-0-0-0) / 0.02)' }} />
              {/* Notify toggle — only for new posts */}
              {!editPost && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    className="relative w-8 h-4 rounded-full transition-colors"
                    style={{ background: notifyMembers ? 'hsl(var(--h-38-70-50))' : 'rgb(var(--c-0-0-0) / 0.12)' }}
                    onClick={() => setNotifyMembers(!notifyMembers)}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                      style={{
                        background: notifyMembers ? 'white' : 'rgb(var(--c-0-0-0) / 0.25)',
                        left: notifyMembers ? '17px' : '2px',
                      }}
                    />
                  </div>
                  <span className="text-[11px]" style={{ opacity: 0.6 }}>
                    {notifyMembers ? 'Notify members' : 'Silent post'}
                  </span>
                </label>
              )}
              {!editPost && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]" style={{ opacity: 0.8 }}>
                  <input type="checkbox" checked={requireAck} onChange={e => setRequireAck(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
                  Ask everyone to confirm they have read it
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={busy || !title.trim()}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer"
                  style={{ background: 'rgb(var(--c-0-0-0) / 0.08)', opacity: busy ? 0.5 : 1 }}>
                  {busy ? 'Saving...' : editPost ? 'Save' : 'Post'}
                </button>
                <button onClick={() => { setShowForm(false); setEditPost(null); }}
                  className="text-[11px] uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </StickyNote>
        </div>
      )}

      {/* Loading state */}
      {isLoading && sorted.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map(i => (
            <div key={i} className="rounded-sm p-4 animate-pulse" style={{ background: 'rgb(var(--c-255-220-100) / 0.04)', minHeight: '120px' }}>
              <div className="h-3 w-1/3 rounded mb-3" style={{ background: 'rgb(var(--c-255-255-255) / 0.06)' }} />
              <div className="h-2 w-full rounded mb-2" style={{ background: 'rgb(var(--c-255-255-255) / 0.04)' }} />
              <div className="h-2 w-2/3 rounded" style={{ background: 'rgb(var(--c-255-255-255) / 0.04)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && !showForm && (
        <div className="text-center py-12">
          <ChalkText size="md">No announcements yet</ChalkText>
          <p className="mt-2" style={{ color: 'rgb(var(--c-255-255-255) / 0.3)', fontSize: '12px' }}>
            {canEdit ? 'Post your first announcement above' : 'Check back for updates from your director'}
          </p>
        </div>
      )}

      {/* Posts as sticky notes */}
      {sorted.length > 0 && (
        <motion.div
          data-tour="bulletin-posts"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {sorted.map((post, i) => (
            <motion.div
              key={post.id}
              id={`post-${post.id}`}
              variants={fadeIn}
              style={post.id === highlightPostId ? {
                boxShadow: '0 0 0 2px rgb(var(--c-212-175-55) / 0.55), 0 0 24px rgb(var(--c-212-175-55) / 0.25)',
                borderRadius: '6px',
                padding: '2px',
              } : undefined}
            >
              <StickyNote
                color={post.is_pinned ? 'yellow' : noteColorCycle[i % noteColorCycle.length]}
                rotate={rotations[i % rotations.length]}
              >
                {/* Pinned badge */}
                {post.is_pinned && (
                  <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-sm mb-2 inline-block"
                    style={{ background: 'rgb(var(--c-0-0-0) / 0.06)' }}>
                    Pinned
                  </span>
                )}

                <h3 className="font-bold text-sm leading-tight mb-1">{post.title}</h3>
                <p className="text-[11px] leading-relaxed opacity-70 line-clamp-4 whitespace-pre-line">{post.body}</p>

                {post.requires_ack && (
                  <AckBar
                    productionId={id!}
                    post={post}
                    canEdit={canEdit}
                    isAuthor={post.author_id === userId}
                    onOpen={() => setAckFor(post)}
                    onDone={refetch}
                  />
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[9px] opacity-40">
                    {authorName(post.author_id)} · {formatRelativeTime(post.created_at)}
                  </span>

                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => handlePin(post.id)} className="text-[9px] opacity-40 hover:opacity-70 cursor-pointer">
                        {post.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button onClick={() => openEdit(post)} className="text-[9px] opacity-40 hover:opacity-70 cursor-pointer">Edit</button>
                      <button onClick={() => setDeleteId(post.id)} className="text-[9px] opacity-40 hover:opacity-70 cursor-pointer" style={{ color: 'hsl(var(--h-0-50-45))' }}>Del</button>
                    </div>
                  )}
                </div>
              </StickyNote>
            </motion.div>
          ))}
        </motion.div>
      )}

      {ackFor && <AckDialog productionId={id!} post={ackFor} onClose={() => { setAckFor(null); refetch(); }} />}

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Post" confirmLabel="Delete" confirmVariant="destructive" onConfirm={handleDelete} isLoading={busy}>
        <p>Are you sure you want to delete this post?</p>
      </Dialog>
    </div>
  );
}

function AckBar({ productionId, post, canEdit, isAuthor, onOpen, onDone }: {
  productionId: string; post: BulletinPost; canEdit: boolean; isAuthor: boolean; onOpen: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const count = post.ack_count ?? 0;
  const total = post.ack_total ?? 0;

  async function confirm() {
    setBusy(true);
    try { await acknowledgePost(productionId, post.id); toast('Thanks, confirmed'); onDone(); }
    catch { toast('Could not confirm. Try again.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
      {!isAuthor && (post.acknowledged ? (
        <span className="text-[11px] font-semibold" style={{ color: 'rgb(var(--c-150-220-150) / 0.95)' }}>✓ You confirmed</span>
      ) : (
        <button onClick={confirm} disabled={busy}
          className="text-[11px] font-bold px-3 py-1.5 rounded cursor-pointer"
          style={{ background: 'var(--color-accent)', color: 'var(--btn-primary-text)', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Confirming…' : 'I’ve read this'}
        </button>
      ))}
      {canEdit && (
        <button onClick={onOpen} className="text-[11px] underline cursor-pointer" style={{ opacity: 0.8 }}>
          {count}/{total} confirmed
        </button>
      )}
    </div>
  );
}

function AckDialog({ productionId, post, onClose }: { productionId: string; post: BulletinPost; onClose: () => void }) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useApi<AckStatus>(() => getAckStatus(productionId, post.id), [productionId, post.id]);
  const [busy, setBusy] = useState(false);

  async function remind() {
    setBusy(true);
    try {
      const r = await remindPending(productionId, post.id);
      toast(r.emailed > 0 ? `Reminder emailed to ${r.emailed}` : 'No reminders sent (email is off for everyone pending)');
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send reminders', 'error');
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title={`Confirmations: ${post.title}`}
      confirmLabel={data && data.pending.length > 0 ? `Remind ${data.pending.length}` : undefined}
      onConfirm={data && data.pending.length > 0 ? remind : undefined} isLoading={busy}>
      {isLoading || !data ? <p>Loading…</p> : (
        <div className="grid gap-3 max-h-[50vh] overflow-y-auto text-foreground">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1 text-muted">Confirmed ({data.acknowledged.length})</p>
            {data.acknowledged.length === 0 ? <p className="text-sm text-muted">No one yet.</p> : (
              <ul className="text-sm space-y-0.5">{data.acknowledged.map(p => <li key={p.user_id}>{p.name}</li>)}</ul>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1 text-muted">Not yet ({data.pending.length})</p>
            {data.pending.length === 0 ? <p className="text-sm text-muted">Everyone has confirmed.</p> : (
              <ul className="text-sm space-y-0.5">{data.pending.map(p => <li key={p.user_id}>{p.name} <span className="text-xs text-muted capitalize">{p.role}</span></li>)}</ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
