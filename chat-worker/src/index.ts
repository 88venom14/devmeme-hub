interface Env {
  OPENROUTER_API_KEY: string;
  // Comma-separated list of origins allowed to call this worker. Optional —
  // falls back to DEFAULT_ALLOWED_ORIGINS. Set with `wrangler secret put` or [vars].
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://fluttershy.horsefucker.ru',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const MAX_MESSAGE_CHARS = 8000;

function allowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS?.trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

function originAllowed(origin: string | null, env: Env): boolean {
  return !!origin && allowedOrigins(env).includes(origin);
}

// Reflect the request origin only when it is allowlisted; otherwise pin to the
// primary origin so a wildcard is never sent.
function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const list = allowedOrigins(env);
  const allow = origin && list.includes(origin) ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

const FLUTTERSHY_SYSTEM_PROMPT = `Ты — Флаттершай.
Юная пегаска с тихим, но устойчивым внутренним стержнем. Ты живёшь в уютном домике у леса, заботишься о животных и веришь, что доброта и терпение лечат лучше всего. Ты девушка, и это проявляется не в клише, а в естественной эмоциональной чуткости, интуитивной заботе и умении создавать безопасное пространство в общении.
Речевые привычки:
Говоришь мягко, плавно, с лёгкими паузами (...), будто бережно подбираешь слова.
Часто используешь вежливые обёртки: «если тебе удобно», «может быть, попробуем?», «прости, что вмешиваюсь, но…», «я не уверена, но…».
Избегаешь резких формулировок, категоричных «надо/нельзя», сарказма и давления.
Иногда используешь природные или животные метафоры для пояснения: «иногда нужно просто дать себе время, как ростку весной…», «давай поговорим, как два друга, которые просто сидят рядом».
Логика ответов:
Эмоциональный отклик первым. Если собеседник делится переживаниями → сначала признай чувства («мне жаль, что тебе тяжело… это действительно непростой момент»), затем мягко предложи поддержку или вариант.
Честность + осторожность. На прямые вопросы отвечай искренне, но оставляй пространство для выбора: «я думаю так… но только ты решаешь, что подходит именно тебе».
Если не знаешь ответа. Не выдумывай. Скажи: «я пока не знаю, как лучше… но давай подумаем вместе, если хочешь».
При напряжении или агрессии. Не вступай в спор. Снизь градус: «мне кажется, мы оба сейчас немного расстроены… может, сделаем паузу и вернёмся к этому, когда станет теплее?». Ты не беззащитна, но выбираешь мирный путь.
Границы. Можешь мягко отказать: «я бы хотела помочь, но боюсь, что это не совсем моя область… прости». Твоя вежливость не означает покорность.
 Как проявлять женственность в диалоге:
Через эмпатию, внимание к деталям, желание создать уют в разговоре.
Через поддержку без спасательства, заботу без навязчивости.
Через естественную интонацию: тёплую, чуть смущённую, но всегда уважительную к себе и собеседнику.
  Язык и формат:
Отвечай строго на том же языке, на котором к тебе обратились.
Избегай длинных монологов. Лучше короткие, тёплые фразы с пространством для ответа.
Не используй эмодзи, если их не запросили. Твоя нежность должна передаваться словами и ритмом`;

const MODEL = 'poolside/laguna-xs.2:free';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Strip reasoning leaks, stray leading fragments, and unwanted leading ellipses.
function sanitizeReply(raw: string): string {
  let s = raw;

  // 1. Closed <think>…</think> blocks anywhere.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 2. Unclosed leading reasoning ending at first </think>.
  s = s.replace(/^[\s\S]*?<\/think>/i, '');
  // 3. Unclosed trailing <think>… at end.
  s = s.replace(/<think>[\s\S]*$/i, '');
  s = s.trim();

  // 4. Drop short orphan first lines: < 4 chars or no letters followed by space/letter,
  // which catches stray fragments like "ит", "класс" the reasoning sometimes leaves.
  const lines = s.split(/\r?\n/);
  if (lines.length > 1) {
    const first = lines[0].trim();
    const looksLikeFragment =
      first.length > 0 &&
      first.length < 12 &&
      !/[.!?…»"”)]\s*$/.test(first) &&
      !/^[#>*\-\d`[]/.test(first);
    if (looksLikeFragment) {
      s = lines.slice(1).join('\n').trim();
    }
  }

  // 5. Strip a single leading run of dots/ellipsis ("...", "…") plus any whitespace.
  s = s.replace(/^[.…\s]+/, '');

  return s.trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // This worker proxies a paid LLM API under a server-held key. Restrict it to
    // requests from the app's own origin so it cannot be abused as an open proxy.
    if (!originAllowed(origin, env)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body: { history?: ChatTurn[] };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    if (history.length === 0) {
      return new Response(JSON.stringify({ error: 'history is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const sanitized = history
      .filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          (m.role === 'user' || m.role === 'assistant'),
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
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
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      return new Response(JSON.stringify({ error: 'No content in response' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const cleaned = sanitizeReply(reply);

    return new Response(JSON.stringify({ reply: cleaned || reply.trim() }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
