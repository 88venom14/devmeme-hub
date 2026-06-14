import { api } from './api';

// The server derives the owning user from the auth token, so no userId is needed.
export async function uploadPostMedia(file: File): Promise<string> {
  const { url } = await api.uploadMedia(file);
  return url;
}
