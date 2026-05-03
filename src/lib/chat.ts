// Calls the devmeme-chat Cloudflare Worker, which holds the OpenRouter key as a secret.

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function fluttershyReply(history: ChatTurn[]): Promise<string> {
  const url = import.meta.env.VITE_CHAT_WORKER_URL;
  if (!url) throw new Error('VITE_CHAT_WORKER_URL not configured.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error ?? '';
    } catch {
      detail = await res.text();
    }
    throw new Error(`Chat ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { reply?: string };
  if (typeof data.reply !== 'string') throw new Error('No reply in response.');
  return data.reply;
}
