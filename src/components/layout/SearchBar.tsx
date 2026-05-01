import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

type Tag = { id: string; name: string };

function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SearchBar: React.FC = memo(() => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useDebouncedValue(
    query.trim().replace(/^#/, '').toLowerCase(),
    200,
  );

  useEffect(() => {
    if (!debounced) { setSuggestions([]); return; }
    let cancelled = false;
    queryClient.fetchQuery({
      queryKey: ['tag-suggestions', debounced],
      staleTime: 30_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name')
          .ilike('name', `${debounced}%`)
          .order('name')
          .limit(8);
        if (error) throw error;
        return (data ?? []) as Tag[];
      },
    }).then((data) => { if (!cancelled) setSuggestions(data); });
    return () => { cancelled = true; };
  }, [debounced, queryClient]);

  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  const goToTag = useCallback(
    (name: string) => {
      const clean = name.trim().toLowerCase().replace(/^#/, '');
      if (!clean) return;
      setOpen(false);
      setQuery('');
      navigate(`/tag/${encodeURIComponent(clean)}`);
    },
    [navigate],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  }, []);

  const handleFocus = useCallback(() => setOpen(true), []);

  const handleBlur = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          goToTag(suggestions[activeIndex].name);
        } else if (query.trim()) {
          goToTag(query);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [activeIndex, suggestions, goToTag, query],
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        width="14" height="14"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{
          position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-3)', pointerEvents: 'none',
        }}
      >
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
      </svg>
      <input
        type="text"
        placeholder="поиск тегов, авторов, мемов…"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
        onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
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
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            maxHeight: 280, overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); goToTag(s.name); }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                  fontSize: 13,
                  background: i === activeIndex ? 'var(--bg-2)' : 'transparent',
                  color: 'var(--text-1)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span style={{ color: 'var(--text-3)' }}>#</span>
                {s.name}
              </li>
            ))
          ) : (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); if (query.trim()) goToTag(query); }}
              style={{
                padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
              }}
            >
              Ничего не найдено. Enter — перейти к{' '}
              <span style={{ color: 'var(--accent)' }}>#{debounced}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
