import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link as LinkIcon, Send, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInvalidatePosts } from '../../hooks/useInvalidatePosts';
import { parseTags, attachTagsToPost } from '../../lib/tags';

const PostComposer: React.FC = () => {
  const invalidatePosts = useInvalidatePosts();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to post');

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          github_url: githubUrl.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      const tags = parseTags(tagsInput);
      if (tags.length > 0) await attachTagsToPost(data.id, tags);

      return data;
    },
    onSuccess: () => {
      invalidatePosts();
      setTitle(''); setDescription(''); setGithubUrl(''); setTagsInput('');
      setIsExpanded(false); setErrorMsg(null);
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createPost.isPending) return;
    createPost.mutate();
  };

  return (
    <div className="card" style={{ padding: '16px' }}>
      <form onSubmit={handleSubmit}>
        {!isExpanded ? (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--bg-main)', flexShrink: 0 }} />
            <input
              type="text" placeholder="What's your latest tech meme or project?"
              style={{ width: '100%', border: 'none', background: 'var(--bg-main)' }}
              onFocus={() => setIsExpanded(true)}
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text" placeholder="Title of your post"
              style={{ width: '100%', fontWeight: 'bold' }}
              value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            />
            <textarea
              placeholder="Description or Markdown content..."
              style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ position: 'relative' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="GitHub Repo URL (optional)"
                style={{ width: '100%', paddingLeft: '36px' }}
                value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Hash size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="tags (e.g. react, supabase)"
                style={{ width: '100%', paddingLeft: '36px' }}
                value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--error)', fontSize: '13px' }} className="mono">
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <a href="/post/new" className="text-secondary" style={{ fontSize: '12px' }}>
                Need media or full editor? →
              </a>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-sm" onClick={() => setIsExpanded(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim() || createPost.isPending}>
                  <Send size={16} style={{ marginRight: '6px' }} />
                  {createPost.isPending ? 'Posting...' : 'Share Post'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default PostComposer;
