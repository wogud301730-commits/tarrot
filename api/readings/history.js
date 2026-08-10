// GET /api/readings/history?session_id=... — docs/03-backend-api-spec.md
// PRD FR-8: 브라우저(기기)별 익명 세션의 최근 리딩 기록 (최대 20건, 최신순).

const { getSupabaseAdmin } = require('../../lib/supabaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET만 지원합니다.' } });
    return;
  }

  const { session_id: sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: { code: 'INVALID_SESSION_ID', message: 'session_id가 필요합니다.' } });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('readings')
      .select('id, created_at, spreads ( code ), reading_interpretations ( summary )')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.status(200).json({
      readings: data.map((r) => ({
        reading_id: r.id,
        spread_code: r.spreads?.code ?? null,
        created_at: r.created_at,
        summary: r.reading_interpretations?.summary ?? null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
