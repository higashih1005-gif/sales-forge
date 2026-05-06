import { createClient } from '@supabase/supabase-js';

// Supabase接続（Vercelに登録した環境変数を使います）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS設定（スマホや別ドメインからの拒否を防ぐ）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Supabaseから今日の利用回数を取得
    const { data: usage, error: upsertError } = await supabase
      .from('usage_limits')
      .select('count, last_request')
      .eq('identifier', ip)
      .eq('date', today)
      .single();

    let currentCount = usage ? usage.count : 0;
    let lastRequest = usage ? new Date(usage.last_request).getTime() : 0;

    // 2. 連打防止（3秒）
    if (Date.now() - lastRequest < 3000) {
      return res.status(429).json({ error: '少し待ってから再試行してください' });
    }

    // 3. 1日3回制限（東丸さんの設定に合わせました）
    if (currentCount >= 3) {
      return res.status(429).json({ error: '1日の利用上限（3回）に達しました。明日またご利用ください。' });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '入力が空です' });

    // 4. Gemini API 実行
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `あなたは伝説の営業マンです。以下の入力を最高のセールス武器に鍛え上げてください：${prompt}` }] }]
        }),
      }
    );

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';

    // 5. Supabaseのカウントを更新
    await supabase.from('usage_limits').upsert({
      identifier: ip,
      date: today,
      count: currentCount + 1,
      last_request: new Date().toISOString()
    }, { onConflict: 'identifier,date' });

    res.status(200).json({ content: [{ type: 'text', text: resultText }] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
// fix: redeploy for supabase
