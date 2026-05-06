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

  // 🔍 IP取得
  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  const ip = rawIp ? rawIp.split(',')[0].trim() : 'unknown';

  const today = new Date().toISOString().split('T')[0];

  try {
    // 📊 usage取得
    const { data: usage } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('identifier', ip)
      .eq('date', today)
      .maybeSingle();

    let currentCount = usage?.count || 0;
    let lastRequest = usage?.last_request
      ? new Date(usage.last_request).getTime()
      : 0;

    const now = Date.now();
    const diff = now - lastRequest;

    console.log({
      ip,
      currentCount,
      lastRequest,
      now,
      diff,
    });

    // 🚫 軽めの連打防止（1秒）
    if (diff < 1000) {
      return res.status(429).json({
        error: '連続リクエストが速すぎます',
        type: 'rate_limit_short',
      });
    }

    // 🚫 回数制限（開発中はゆるめ）
    if (currentCount >= 100) {
      return res.status(429).json({
        error: '本日の上限に達しました',
        type: 'rate_limit_daily',
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: '入力が空です' });
    }

    // 🤖 Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `あなたは伝説の営業マンです。以下を最強の営業トークに変換してください：${prompt}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Error:', errText);
      return res.status(500).json({ error: 'AI生成エラー' });
    }

    const data = await response.json();

    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      '生成に失敗しました';

    // ✅ usage更新（ここ重要）
    const { error: upsertError } = await supabase
      .from('usage_limits')
      .upsert({
        identifier: ip,
        date: today,
        count: currentCount + 1,
        last_request: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('Supabase update error:', upsertError);
    }

    return res.status(200).json({ result: resultText });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'サーバーエラー' });
  }
}
