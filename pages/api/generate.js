import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  const ip = rawIp ? rawIp.split(',')[0].trim() : 'unknown';
  const today = new Date().toISOString().split('T')[0];

  let currentCount = 0;
  let lastRequest = 0;

  try {
    const { data: usage, error } = await supabase
      .from('usage_limits')
      .select('count, last_request')
      .eq('identifier', ip)
      .eq('date', today)
      .maybeSingle();

    if (error) console.error('Supabase fetch error:', error);
    currentCount = usage?.count || 0;
    lastRequest = usage?.last_request ? new Date(usage.last_request).getTime() : 0;
  } catch (e) {
    console.error('Supabase取得失敗:', e);
  }

  if (Date.now() - lastRequest < 3000) {
    return res.status(429).json({ success: false, error: '少し待ってください' });
  }

  if (currentCount >= 100) {
    return res.status(429).json({ success: false, error: '本日の上限に達しました' });
  }

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ success: false, error: '入力が空です' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `あなたは伝説の営業マンです。以下を最強の営業トークに変換してください：${prompt}` }] }]
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Error:', errText);
      return res.status(500).json({ success: false, error: 'Gemini APIエラー', detail: errText });
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return res.status(500).json({ success: false, error: '生成結果が空', detail: data });
    }

    try {
      await supabase.from('usage_limits').upsert({
        identifier: ip,
        date: today,
        count: currentCount + 1,
        last_request: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Supabase更新失敗:', e);
    }

    return res.status(200).json({ success: true, text: resultText });

  } catch (err) {
    console.error('API fatal error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
