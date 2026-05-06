import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ▼ IP取得（Vercel対応）
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      'unknown';

    // ▼ usage取得（ログ用）
    const { data, error } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('ip', ip)
      .maybeSingle(); // ← なければnullでOK

    if (error) {
      console.error('Supabase error:', error);
    }

    console.log('usage debug:', {
      ip,
      usageData: data,
    });

    // ★★★ ここが重要 ★★★
    // 制限は一切しない（returnしない）

    // ▼ あなたの本来の処理を書く
    return res.status(200).json({
      success: true,
      debug: data || null, // 不要なら消してOK
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
