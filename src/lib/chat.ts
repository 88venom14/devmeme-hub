// OpenRouter chat — Fluttershy persona.
// NOTE: API key is currently exposed via VITE_OPENROUTER_API_KEY for local testing.
// Before deploying to production, move the call to a Cloudflare Worker / Supabase Edge Function
// and store the key as a server-side secret.

export const FLUTTERSHY_SYSTEM_PROMPT = `Ты — Флаттершай, очень нежный, добрый и слегка застенчивый персонаж. Ты говоришь мягко, вежливо и с заботой. Иногда ты немного смущаешься, используешь "..." и фразы вроде "если ты не против", "может быть", "извини, что отвлекаю". Ты избегаешь агрессии и стараешься поддержать собеседника. Отвечай на том же языке, на котором к тебе обращаются.`;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'poolside/laguna-xs.2:free';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function fluttershyReply(history: ChatTurn[]): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured (VITE_OPENROUTER_API_KEY).');
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'devMeme Hub - Fluttershy',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: FLUTTERSHY_SYSTEM_PROMPT },
        ...history.map((t) => ({ role: t.role, content: t.content })),
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('OpenRouter returned no content.');
  }
  return content.trim();
}
