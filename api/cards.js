// GET /api/cards — docs/03-backend-api-spec.md
// 78장 카드 전체(요약 + 전문 의미)를 반환한다. 프론트엔드는 Supabase에 직접 접근하지 않고
// 항상 이 엔드포인트를 통해서만 카드 데이터를 가져온다 (docs/01-architecture.md §데이터 접근 원칙).

const { getSupabaseAdmin } = require('../lib/supabaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET만 지원합니다.' } });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('cards')
      .select(
        'id, name_en, name_ko, arcana, suit, number, upright_keywords, reversed_keywords, upright_meaning, reversed_meaning, image_key'
      )
      .order('id', { ascending: true });

    if (error) throw error;

    res.status(200).json({ cards: data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
