import { supabase } from './supabase';

export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter((t) => /^[a-z0-9][a-z0-9_-]{0,30}$/.test(t)),
    ),
  );
}

export async function attachTagsToPost(postId: string, tagNames: string[]) {
  if (tagNames.length === 0) return;

  const { data: existing, error: selErr } = await supabase
    .from('tags')
    .select('id, name')
    .in('name', tagNames);
  if (selErr) throw selErr;

  const existingNames = new Set((existing ?? []).map((t) => t.name));
  const toCreate = tagNames.filter((n) => !existingNames.has(n));

  let created: { id: string; name: string }[] = [];
  if (toCreate.length > 0) {
    const { data, error } = await supabase
      .from('tags')
      .insert(toCreate.map((name) => ({ name })))
      .select('id, name');
    if (error) throw error;
    created = data ?? [];
  }

  const allTags = [...(existing ?? []), ...created];
  const links = allTags.map((t) => ({ post_id: postId, tag_id: t.id }));
  if (links.length > 0) {
    const { error: linkErr } = await supabase.from('post_tags').insert(links);
    if (linkErr) throw linkErr;
  }
}
