import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawIp = req.headers['x-forwarded-for'] || 'unknown';
  const ip = rawIp.split(',')[0].trim();
  const today = new Date().toISOString().split('T')[0];

  let currentCount = 0;
  let lastRequest = 0;

  try {
    const { data: usage } = await supabase
      .from('usage_limits')
      .select('count, last_request')
      .eq('identifier', ip)
      .eq('date', today)
      .maybeSingle();
    currentCount = usage?.count || 0;
    lastRequest = usage?.last_request ? new Date(usage.last_request).getTime() : 0;
  } catch(e) {
    console.log('Supabase error:', e.message);
  }

  console.log('Gemini呼び出し開始');

  if (Date.now() - lastRequest < 3000) {
    return res.status(429).json({ success: false, error: '少し待ってください' });
  }
  if (currentCount >= 100) {
    return res.status(429).json({ success: false, error: '本日の上限に達しました' });
  }

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ success: false, error: '入力が空です' });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        }),
      }
    );

    const geminiText = await geminiRes.text();
    console.log('Gemini status:', geminiRes.status);
    console.log('Gemini response:', geminiText);

    if (!geminiRes.ok) {
      return res.status(500).json({ success: false, error: 'Gemini APIエラー', detail: geminiText });
    }

    const data = JSON.parse(geminiText);
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return res.status(500).json({ success: false, error: '生成結果が空' });
    }

    await supabase.from('usage_limits').upsert({
      identifier: ip,
      date: today,
      count: currentCount + 1,
      last_request: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, text: resultText });

  } catch(e) {
    console.log('Gemini fetch error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
