const ipRequests = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const today = new Date().toDateString();

  if (!ipRequests[ip]) {
    ipRequests[ip] = { count: 0, date: today, lastRequest: 0 };
  }

  if (ipRequests[ip].date !== today) {
    ipRequests[ip] = { count: 0, date: today, lastRequest: 0 };
  }

  // 連打防止（3秒）
  if (now - ipRequests[ip].lastRequest < 3000) {
    return res.status(429).json({ error: '少し待ってから再試行してください' });
  }

  // 1日3回制限
  if (ipRequests[ip].count >= 3) {
    return res.status(429).json({ error: '1日の利用上限（10回）に達しました。明日またご利用ください。' });
  }

  const { prompt } = req.body;

  // 文字数制限
  if (!prompt || prompt.length > 1000) {
    return res.status(400).json({ error: '入力は1000文字以内にしてください' });
  }

  ipRequests[ip].count += 1;
  ipRequests[ip].lastRequest = now;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
