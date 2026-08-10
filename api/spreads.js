// GET /api/spreads — docs/03-backend-api-spec.md
// PRD FR-2 제약: 스프레드 종류를 프론트엔드에 하드코딩하지 않고 이 응답으로 렌더링한다.

const { getSupabaseAdmin } = require('../lib/supabaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET만 지원합니다.' } });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('spreads')
      .select('id, code, name_ko, description, position_count, position_labels')
      .order('id', { ascending: true });

    if (error) throw error;

    res.status(200).json({ spreads: data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
