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

  // ✅ IPを安定取得（Vercel対応）
  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
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

    // 連打防止
    if (Date.now() - lastRequest < 3000) {
      return res.status(429).json({ error: '少し待ってください' });
    }

    // 回数制限
    if (currentCount >= 100) {
      return res.status(429).json({ error: '本日の上限に達しました' });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: '入力が空です' });
    }

    // ✅ Gemini（完全版）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
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

    // ❗ここ重要（エラー拾う）
    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Error:", errText);
      throw new Error(errText);
    }

    const data = await response.json();

    // ✅ 安全に取り出す
    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      '生成に失敗しました';

    // ✅ Supabase更新（失敗しても処理は続ける）
    const { error: upsertError
