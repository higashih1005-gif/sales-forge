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

  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      'unknown';

    try {
      const { data } = await supabase
        .from('usage_limits')
        .select('*')
        .limit(1);

      console.log('usage debug:', { ip, data });
    } catch (e) {
      console.log('Supabase無視:', e.message);
    }

    // ▼ ここが本来の処理（仮でOK）
    const resultText = "生成テスト成功";

    return res.status(200).json({
      success: true,
      text: resultText, // ← ★これが重要
    });

  } catch (err) {
    console.error('API fatal error:', err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
