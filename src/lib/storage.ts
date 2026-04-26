import { supabase } from './supabase';

const BUCKET = 'post-media';

export async function uploadPostMedia(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
