import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

type TagResult     = { kind: 'tag';     id: string; name: string };
type PostResult    = { kind: 'post';    id: string; title: string };
type ProfileResult = { kind: 'profile'; username: string; display_name: string | null };
type SearchResult  = TagResult | PostResult | ProfileResult;

function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SearchBar: React.FC = memo(() => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery]           = useState('');
  const [open, setOpen]             = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults]       = useState<SearchResult[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTagMode  = query.trimStart().startsWith('#');
  const cleanQuery = query.trim().replace(/^#/, '').toLowerCase();

  const debounced     = useDebouncedValue(cleanQuery, 200);
  const debouncedMode = useDebouncedValue(isTagMode,  200);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;

    if (debouncedMode) {
      queryClient.fetchQuery({
        queryKey: ['tag-suggestions', debounced],
        staleTime: 30_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('tags').select('id, name')
            .ilike('name', `${debounced}%`).order('name').limit(8);
          if (error) throw error;
          return (data ?? []) as { id: string; name: string }[];
        },
      }).then((data) => {
        if (!cancelled) setResults(data.map((t) => ({ kind: 'tag' as const, ...t })));
      });
    } else {
      Promise.all([
        queryClient.fetchQuery({
          queryKey: ['profile-suggestions', debounced],
          staleTime: 30_000,
          queryFn: async () => {
            const { data, error } = await supabase
              .from('profiles').select('username, display_name')
              .or(`username.ilike.%${debounced}%,display_name.ilike.%${debounced}%`)
              .limit(3);
            if (error) throw error;
            return (data ?? []) as { username: string; display_name: string | null }[];
          },
        }),
        queryClient.fetchQuery({
          queryKey: ['post-suggestions', debounced],
          staleTime: 30_000,
          queryFn: async () => {
            const { data, error } = await supabase
              .from('posts').select('id, title')
              .ilike('title', `%${debounced}%`)
              .order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            return (data ?? []) as { id: string; title: string }[];
          },
        }),
      ]).then(([profiles, posts]) => {
        if (!cancelled) setResults([
          ...profiles.map((p) => ({ kind: 'profile' as const, ...p })),
          ...posts.map((p)    => ({ kind: 'post'    as const, ...p })),
        ]);
      });
    }

    return () => { cancelled = true; };
  }, [debounced, debouncedMode, queryClient]);

  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  const goToResult = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery('');
    if (result.kind === 'tag')     navigate(`/tag/${encodeURIComponent(result.name)}`);
    else if (result.kind === 'post')    navigate(`/post/${result.id}`);
    else                                navigate(`/profile/${result.username}`);
  }, [navigate]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  }, []);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        goToResult(results[activeIndex]);
      } else if (isTagMode && cleanQuery) {
        goToResult({ kind: 'tag', id: '', name: cleanQuery });
      } else if (!isTagMode && results.length > 0) {
        goToResult(results[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [activeIndex, results, goToResult, isTagMode, cleanQuery]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}
      >
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
      </svg>

      <input
        type="text"
        placeholder={isTagMode ? 'поиск тегов…' : 'поиск авторов, постов… (# для тегов)'}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKey}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        style={{
          width: '100%', paddingLeft: 32, paddingRight: 40, height: 34,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 6, fontSize: 13, color: 'var(--text-1)',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
        onBlurCapture={(e)  => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
      />

      <div style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10,
        padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3,
        pointerEvents: 'none',
      }}>⌘K</div>

      {open && debounced.length > 0 && (
        <ul
          role="listbox"
          style={{
            listStyle: 'none',
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: 4, padding: 4,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: 8, maxHeight: 320, overflowY: 'auto',
            zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {results.length > 0 ? results.map((r, i) => (
            <li
              key={r.kind === 'tag' ? `tag-${r.id}` : r.kind === 'post' ? `post-${r.id}` : `profile-${r.username}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); goToResult(r); }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                fontSize: 13,
                background: i === activeIndex ? 'var(--bg-2)' : 'transparent',
                color: 'var(--text-1)',
              }}
            >
              {r.kind === 'tag' && (
                <>
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>#</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{r.name}</span>
                </>
              )}
              {r.kind === 'profile' && (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
                  </svg>
                  <span style={{ fontWeight: 500 }}>{r.display_name || r.username}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>@{r.username}</span>
                </>
              )}
              {r.kind === 'post' && (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                </>
              )}
            </li>
          )) : (
            <li style={{
              padding: '7px 10px', fontSize: 12,
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              {isTagMode
                ? <>Тег не найден — Enter для перехода к <span style={{ color: 'var(--accent)' }}>#{debounced}</span></>
                : 'Ничего не найдено'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
