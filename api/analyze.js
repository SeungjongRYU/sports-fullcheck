export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { claudeKey, messages } = req.body;

  async function callClaude(msgs) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: msgs
      })
    });
    return r.json();
  }

  try {
    let msgs = [...messages];
    let finalText = '';
    let rounds = 0;

    while (rounds < 6) {
      const data = await callClaude(msgs);
      rounds++;

      if (data.error) {
        return res.status(200).json({ text: 'API 오류: ' + (data.error.message || JSON.stringify(data.error)) });
      }

      const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (textBlocks) finalText = textBlocks;

      if (data.stop_reason === 'end_turn') break;

      if (data.stop_reason === 'tool_use') {
        const toolUses = (data.content || []).filter(b => b.type === 'tool_use');
        if (!toolUses.length) break;
        msgs.push({ role: 'assistant', content: data.content });
        const toolResults = toolUses.map(tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: '검색이 완료되었습니다. 수집된 정보를 바탕으로 풀체크 분석을 완성하세요.'
        }));
        msgs.push({ role: 'user', content: toolResults });
      } else {
        break;
      }
    }

    res.status(200).json({ text: finalText || '분석 결과를 가져오지 못했습니다.' });
  } catch (e) {
    res.status(500).json({ text: '서버 오류: ' + e.message });
  }
}
