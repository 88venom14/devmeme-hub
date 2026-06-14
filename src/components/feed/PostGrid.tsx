import React, { useEffect, useState } from 'react';

/** Responsive column count matching the layout.css breakpoints (3 / 2 / 1). */
function getColumnCount(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w <= 768) return 1;
  if (w <= 1100) return 2;
  return 3;
}

function useColumnCount(): number {
  const [cols, setCols] = useState(getColumnCount);
  useEffect(() => {
    const onResize = () => setCols(getColumnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return cols;
}

/**
 * Masonry-style grid that preserves the order of its children.
 *
 * CSS `column-count` fills each column top-to-bottom, so a newest-first list
 * ends up stacked in the left column instead of reading left-to-right. Here we
 * round-robin children across columns by index, so the top row is always the
 * first N items (e.g. the N newest posts), while keeping variable-height
 * masonry packing.
 */
const PostGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cols = useColumnCount();
  const items = React.Children.toArray(children);
  const columns: React.ReactNode[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => {
    columns[i % cols].push(item);
  });

  return (
    <div className="post-grid">
      {columns.map((col, i) => (
        <div className="post-col" key={i}>
          {col}
        </div>
      ))}
    </div>
  );
};

export default PostGrid;
