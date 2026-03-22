"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pin, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";

type Post = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
};

export default function BulletinPage() {
  const { productionId } = useParams<{ productionId: string }>();
  const [tab, setTab] = useState<"posters" | "schedule">("posters");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Role will be determined by whether the new-post form shows
  const [canPost, setCanPost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    loadPosts();
    // Check if user can post (director/staff)
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s?.user?.id) setCurrentUserId(s.user.id);
    });
    fetch(`/api/productions/${productionId}`).then(r => r.json()).then(() => {
      // If we can reach the production, check role via a heuristic:
      // try to fetch roster — 404 means cast
      fetch(`/api/theaters`).then(r => {
        if (r.ok) setCanPost(true); // has a theater = director
      });
    });
  }, [productionId]);

  async function loadPosts() {
    const res = await fetch(`/api/productions/${productionId}/bulletin`);
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }

  async function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    const method = editingId ? "PATCH" : "POST";
    const url = editingId
      ? `/api/productions/${productionId}/bulletin/${editingId}`
      : `/api/productions/${productionId}/bulletin`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    if (res.ok) {
      setTitle("");
      setBody("");
      setEditingId(null);
      loadPosts();
      toast.success(editingId ? "Post updated" : "Post created");
    } else {
      const data = await res.json();
      toast.error(data.message || "Failed to post");
    }
    setPosting(false);
  }

  async function handlePin(postId: string) {
    await fetch(`/api/productions/${productionId}/bulletin/${postId}/pin`, { method: "PATCH" });
    loadPosts();
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/productions/${productionId}/bulletin/${postId}`, { method: "DELETE" });
    loadPosts();
    toast.success("Post deleted");
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(post.body);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isEdited = (post: Post) => post.updatedAt !== post.createdAt;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-serif font-bold">Bulletin Board</h1>

      {/* Tabs */}
      <div className="flex gap-1 mt-4 border-b border-border">
        <button
          onClick={() => setTab("posters")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "posters" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Posters
        </button>
        <button
          onClick={() => setTab("schedule")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "schedule" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Schedule
        </button>
      </div>

      {tab === "schedule" && (
        <div className="mt-6">
          <p className="text-muted-foreground">
            View the full schedule on the{" "}
            <a href={`/production/${productionId}/schedule`} className="text-accent hover:underline">Schedule page</a>.
          </p>
        </div>
      )}

      {tab === "posters" && (
        <div className="mt-6">
          {/* New/Edit post form (director/staff only) */}
          {canPost && (
            <div className="rounded-md border border-border bg-card p-4 mb-6">
              <input
                type="text"
                placeholder="Post title"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="grid md:grid-cols-2 gap-3">
                <textarea
                  placeholder="Write in Markdown..."
                  maxLength={10000}
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
                <div className="rounded-md border border-border bg-surface p-3 text-sm overflow-y-auto max-h-40 prose-sm prose-invert">
                  {body ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {body}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">Preview</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={handlePost} disabled={posting || !title.trim() || !body.trim()}>
                  {posting ? "Posting..." : editingId ? "Update Post" : "Post"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={() => { setEditingId(null); setTitle(""); setBody(""); }}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Posts — cork board styling */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-surface-raised rounded-md animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16" style={{
              background: "radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)"
            }}>
              <p className="text-muted-foreground">No posts yet.</p>
            </div>
          ) : (
            <div
              className="space-y-4 p-4 rounded-md"
              style={{ backgroundColor: "hsl(30, 20%, 18%)" }}
            >
              {posts.map((post, idx) => (
                <article
                  key={post.id}
                  className="relative rounded-md p-5 shadow-lg"
                  style={{
                    backgroundColor: "hsl(40, 30%, 92%)",
                    color: "hsl(25, 15%, 15%)",
                    transform: `rotate(${idx % 2 === 0 ? "-0.5deg" : "0.8deg"})`,
                    boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Pin dot */}
                  <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "hsl(38, 75%, 55%)" }}
                  />

                  {post.isPinned && (
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(38, 75%, 45%)" }}>
                      Pinned
                    </span>
                  )}

                  <h3 className="text-lg font-serif font-bold mt-2">{post.title}</h3>
                  <div className="mt-2 text-sm prose prose-sm max-w-none" style={{ color: "hsl(25, 15%, 25%)" }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        a: ({ ...props }) => <a {...props} rel="noopener noreferrer" target="_blank" className="underline" />,
                      }}
                    >
                      {post.body}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "hsl(25, 10%, 45%)" }}>
                    <span>
                      — {post.authorName}, {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      {isEdited(post) && " (edited)"}
                    </span>

                    {(canPost) && (
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(post)} className="p-1 hover:opacity-70" aria-label="Edit post">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handlePin(post.id)} className="p-1 hover:opacity-70" aria-label={post.isPinned ? "Unpin" : "Pin"}>
                          <Pin className={`h-3.5 w-3.5 ${post.isPinned ? "fill-current" : ""}`} />
                        </button>
                        <button onClick={() => handleDelete(post.id)} className="p-1 hover:opacity-70 text-red-700" aria-label="Delete post">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
