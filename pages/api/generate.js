import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawIp = req.headers['x-forwarded-for'];
  const ip = rawIp ? rawIp.split(',')[0].trim() : 'unknown';

  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: usage } = await supabase
      .from('usage_limits')
      .select('count, last_request')
      .eq('identifier', ip)
      .eq('date', today)
      .maybeSingle();

    let currentCount = usage?.count || 0;
    let lastRequest = usage?.last_request
      ? new Date(usage.last_request).getTime()
      : 0;

    if (Date.now() - lastRequest < 3000) {
      return res.status(429).json({ error: '少し待ってください' });
    }

    if (currentCount >= 3) {
      return res.status(429).json({ error: '本日の上限に達しました' });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '入力が空です' });

    // ✅ Gemini（修正版）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `あなたは伝説の営業マンです。以下を最強の営業トークに変換してください：${prompt}`
                }
              ]
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }

    const data = await response.json();

    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '生成に失敗しました';

    await supabase.from('usage_limits').upsert(
      {
        identifier: ip,
        date: today,
        count: currentCount + 1,
        last_request: new Date().toISOString()
      },
      { onConflict: 'identifier,date' }
    );

    res.status(200).json({
      content: [{ type: 'text', text: resultText }]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
}
