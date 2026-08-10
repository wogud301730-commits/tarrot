// GET /api/readings/:id — docs/03-backend-api-spec.md
// 새로고침/공유 시 특정 리딩 결과를 재조회한다. 응답 형식은 POST /api/readings 성공 응답과 동일하다.

const { getSupabaseAdmin } = require('../../lib/supabaseAdmin');
const { DISCLAIMER } = require('../../lib/openaiClient');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET만 지원합니다.' } });
    return;
  }

  const { id } = req.query;

  try {
    const supabase = getSupabaseAdmin();

    const { data: reading, error: readingError } = await supabase
      .from('readings')
      .select('id, question, created_at, spreads ( code, position_labels )')
      .eq('id', id)
      .single();

    if (readingError || !reading) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '존재하지 않는 리딩입니다.' } });
      return;
    }

    const { data: readingCards, error: readingCardsError } = await supabase
      .from('reading_cards')
      .select('position_index, orientation, cards ( name_ko, name_en, image_key, upright_keywords, reversed_keywords )')
      .eq('reading_id', id)
      .order('position_index', { ascending: true });

    if (readingCardsError) throw readingCardsError;

    const { data: interpretationRow } = await supabase
      .from('reading_interpretations')
      .select('summary, full_text')
      .eq('reading_id', id)
      .maybeSingle();

    res.status(200).json({
      reading_id: reading.id,
      spread: { code: reading.spreads.code, position_labels: reading.spreads.position_labels },
      cards: readingCards.map((rc) => ({
        position_index: rc.position_index,
        card: { name_ko: rc.cards.name_ko, name_en: rc.cards.name_en, image_key: rc.cards.image_key },
        orientation: rc.orientation,
        keywords: rc.orientation === 'upright' ? rc.cards.upright_keywords : rc.cards.reversed_keywords,
      })),
      interpretation: interpretationRow || null,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
