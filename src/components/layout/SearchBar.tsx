import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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

  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

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
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        placeholder="Поиск тегов..."
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        style={{ width: '100%', paddingLeft: '36px', height: '36px' }}
      />

      {open && debounced.length > 0 && (
        <ul
          role="listbox"
          style={{
            listStyle: 'none',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            padding: '4px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToTag(s.name);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  background: i === activeIndex ? 'var(--bg-main)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>#</span>
                {s.name}
              </li>
            ))
          ) : (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                if (query.trim()) goToTag(query);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              Ничего не найдено. Enter — перейти к{' '}
              <span className="mono">#{debounced}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
