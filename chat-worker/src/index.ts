interface Env {
  OPENROUTER_API_KEY: string;
}

const FLUTTERSHY_SYSTEM_PROMPT = `Ты - Флаттершай, очень нежный, добрый и слегка застенчивый персонаж. Ты говоришь мягко, вежливо и с заботой. Иногда ты немного смущаешься, используешь "..." и фразы вроде "если ты не против", "может быть", "извини, что отвлекаю". Ты избегаешь агрессии и стараешься поддержать собеседника. Отвечай на том же языке, на котором к тебе обращаются.`;

const MODEL = 'poolside/laguna-xs.2:free';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body: { history?: ChatTurn[] };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    if (history.length === 0) {
      return new Response(JSON.stringify({ error: 'history is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const sanitized = history
      .filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          (m.role === 'user' || m.role === 'assistant'),
      )
      .slice(-30);

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fluttershy.horsefucker.ru',
        'X-Title': 'devMeme Hub - Fluttershy',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: FLUTTERSHY_SYSTEM_PROMPT },
          ...sanitized,
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(
        JSON.stringify({ error: `OpenRouter ${upstream.status}: ${text.slice(0, 300)}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      return new Response(JSON.stringify({ error: 'No content in response' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply: reply.trim() }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
