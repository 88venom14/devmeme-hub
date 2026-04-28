import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type TopTag = { id: string; name: string; count: number };

export function useTopTags(limit = 12) {
  return useQuery({
    queryKey: ['top-tags', limit],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TopTag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, post_tags(count)');
      if (error) throw error;

      type Row = { id: string; name: string; post_tags: { count: number }[] | null };
      return (data as unknown as Row[])
        .map((t) => ({
          id: t.id,
          name: t.name,
          count: t.post_tags?.[0]?.count ?? 0,
        }))
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },
  });
}
