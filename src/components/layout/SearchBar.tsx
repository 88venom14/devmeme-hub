import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useDebouncedValue(query.trim().replace(/^#/, '').toLowerCase(), 200);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['tag-suggestions', debounced],
    enabled: debounced.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .ilike('name', `${debounced}%`)
        .order('name')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  const goToTag = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    setOpen(false);
    setQuery('');
    navigate(`/tag/${encodeURIComponent(clean)}`);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
  };

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
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
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
                onMouseDown={(e) => { e.preventDefault(); goToTag(s.name); }}
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
                <span style={{ color: 'var(--text-secondary)' }}>#</span>{s.name}
              </li>
            ))
          ) : (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); if (query.trim()) goToTag(query); }}
              style={{
                padding: '8px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              Ничего не найдено. Enter — перейти к <span className="mono">#{debounced}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
