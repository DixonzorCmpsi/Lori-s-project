import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/layout/ProductionLayout';
import { useToast } from '@/components/ui/Toast';
import { getPosts, createPost, updatePost, deletePost, pinPost } from '@/services/bulletin';
import { getSchedule } from '@/services/schedule';
import { formatRelativeTime, formatDate, formatTime } from '@/utils/format';
import { SCHEDULE_COLORS, MAX_LENGTHS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import type { BulletinPost } from '@/types';

function isStaff(role: string | null) {
  return role === 'director' || role === 'staff';
}

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, '<br/>');
}

export function BulletinPage() {
  const { id } = useParams<{ id: string }>();
  const { userRole, members } = useProduction();
  const canEdit = isStaff(userRole);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Bulletin Board</h1>
      <Tabs tabs={[
        { id: 'posters', label: 'Posters', content: <PostersTab productionId={id!} canEdit={canEdit} members={members} /> },
        { id: 'schedule', label: 'Schedule', content: <ScheduleTab productionId={id!} /> },
      ]} />
    </div>
  );
}

function PostersTab({ productionId, canEdit, members }: { productionId: string; canEdit: boolean; members: { user_id: string; name?: string }[] }) {
  const { toast } = useToast();
  const { data: posts, isLoading, refetch } = useApi(() => getPosts(productionId), [productionId]);
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<BulletinPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [posts]);

  function authorName(authorId: string) {
    return members.find(m => m.user_id === authorId)?.name || 'Unknown';
  }

  function openEdit(post: BulletinPost) {
    setEditPost(post);
    setTitle(post.title);
    setBody(post.body);
    setShowForm(true);
  }

  function openNew() {
    setEditPost(null);
    setTitle('');
    setBody('');
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (editPost) {
        await updatePost(productionId, editPost.id, { title, body });
        toast('Post updated');
      } else {
        await createPost(productionId, { title, body });
        toast('Post created');
      }
      setShowForm(false);
      setEditPost(null);
      refetch();
    } catch { toast('Failed to save post', 'error'); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setBusy(true);
    try { await deletePost(productionId, deleteId); toast('Post deleted'); setDeleteId(null); refetch(); }
    catch { toast('Failed to delete', 'error'); }
    finally { setBusy(false); }
  }

  async function handlePin(postId: string) {
    setBusy(true);
    try { await pinPost(productionId, postId); toast('Pin toggled'); refetch(); }
    catch { toast('Failed to pin', 'error'); }
    finally { setBusy(false); }
  }

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div>
      {canEdit && !showForm && (
        <div className="mb-4"><Button onClick={openNew}>New Post</Button></div>
      )}

      {showForm && (
        <div className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-3">
          <h3 className="font-semibold text-foreground">{editPost ? 'Edit Post' : 'New Post'}</h3>
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={MAX_LENGTHS.post_title} />
          <Textarea label="Body (Markdown supported)" value={body} onChange={e => setBody(e.target.value)} maxLength={MAX_LENGTHS.post_body} />
          <div className="flex gap-2">
            <Button onClick={handleSubmit} isLoading={busy} disabled={!title.trim()}>
              {editPost ? 'Save' : 'Post'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditPost(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && <EmptyState title="No posts yet" description="The bulletin board is empty." />}

      <div className="space-y-4">
        {sorted.map(post => (
          <div key={post.id} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{post.title}</h3>
                {post.is_pinned && <Badge variant="warning">Pinned</Badge>}
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handlePin(post.id)}>
                    {post.is_pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(post)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(post.id)}>Delete</Button>
                </div>
              )}
            </div>
            <div className="mt-2 text-foreground text-sm prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
            <div className="mt-3 text-xs text-muted">
              {authorName(post.author_id)} &middot; {formatRelativeTime(post.created_at)}
              {post.updated_at && post.updated_at !== post.created_at && ' (edited)'}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Post" confirmLabel="Delete" confirmVariant="destructive" onConfirm={handleDelete} isLoading={busy}>
        <p>Are you sure you want to delete this post?</p>
      </Dialog>
    </div>
  );
}

function ScheduleTab({ productionId }: { productionId: string }) {
  const { data: dates, isLoading } = useApi(() => getSchedule(productionId), [productionId]);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  const sorted = (dates || []).filter(d => !d.is_deleted).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return <EmptyState title="No schedule yet" />;
  return (
    <div className="space-y-2">
      {sorted.map(d => (
        <div key={d.id} className={`flex items-center gap-3 p-3 rounded-md bg-surface border border-border ${d.is_cancelled ? 'opacity-50' : ''}`}>
          <span className={d.is_cancelled ? 'line-through text-muted' : 'text-foreground font-medium'}>{formatDate(d.date)}</span>
          <span className="text-muted text-sm">{formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
          <Badge className={`${SCHEDULE_COLORS[d.type].bg} ${SCHEDULE_COLORS[d.type].text}`}>{SCHEDULE_COLORS[d.type].label}</Badge>
          {d.is_cancelled && <Badge variant="destructive">Cancelled</Badge>}
          {d.note && <span className="text-muted text-sm truncate">{d.note}</span>}
        </div>
      ))}
    </div>
  );
}
