// POST /api/readings — docs/03-backend-api-spec.md
// 카드 뽑기(서버 랜덤) + AI 해석 생성 + DB 저장을 한 번에 수행하는 핵심 엔드포인트.

const { randomUUID } = require('crypto');
const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { drawCards } = require('../lib/cardEngine');
const { checkRateLimit, WINDOW_SECONDS } = require('../lib/rateLimit');
const {
  generateInterpretation,
  containsCrisisSignal,
  DISCLAIMER,
  CRISIS_RESPONSE_MESSAGE,
} = require('../lib/openaiClient');

const QUESTION_MAX_LENGTH = 200;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST만 지원합니다.' } });
    return;
  }

  const { spread_code: spreadCode, question, session_id: sessionId } = req.body || {};

  if (!spreadCode || typeof spreadCode !== 'string') {
    res.status(400).json({ error: { code: 'INVALID_SPREAD_CODE', message: 'spread_code가 필요합니다.' } });
    return;
  }
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: { code: 'INVALID_SESSION_ID', message: 'session_id가 필요합니다.' } });
    return;
  }
  if (question && typeof question === 'string' && question.length > QUESTION_MAX_LENGTH) {
    res
      .status(400)
      .json({ error: { code: 'QUESTION_TOO_LONG', message: `질문은 ${QUESTION_MAX_LENGTH}자를 넘을 수 없습니다.` } });
    return;
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. 레이트리밋 확인 (docs/03 §레이트리밋: 5분당 5회)
    const rate = await checkRateLimit(supabase, sessionId);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(WINDOW_SECONDS));
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해주세요.' } });
      return;
    }

    // 2. 위기 신호 1차 필터링 (docs/04 §안전 가이드라인) — 감지 시 리딩을 진행하지 않고 안내 문구만 반환
    if (containsCrisisSignal(question)) {
      res.status(200).json({ crisis: true, message: CRISIS_RESPONSE_MESSAGE, disclaimer: DISCLAIMER });
      return;
    }

    // 3. 스프레드 조회
    const { data: spread, error: spreadError } = await supabase
      .from('spreads')
      .select('id, code, name_ko, position_count, position_labels')
      .eq('code', spreadCode)
      .single();

    if (spreadError || !spread) {
      res.status(400).json({ error: { code: 'INVALID_SPREAD_CODE', message: '존재하지 않는 spread_code입니다.' } });
      return;
    }

    // 4. 카드 랜덤 추첨 (서버 전용, AGENTS.md §3.2)
    const { data: allCards, error: allCardsError } = await supabase.from('cards').select('id');
    if (allCardsError) throw allCardsError;

    const draws = drawCards(
      allCards.map((c) => c.id),
      spread.position_count
    );

    const cardIds = draws.map((d) => d.card_id);
    const { data: cardRows, error: cardRowsError } = await supabase
      .from('cards')
      .select(
        'id, name_en, name_ko, upright_keywords, reversed_keywords, upright_meaning, reversed_meaning, image_key'
      )
      .in('id', cardIds);
    if (cardRowsError) throw cardRowsError;

    const cardById = new Map(cardRows.map((c) => [c.id, c]));
    const drawnCards = draws.map((d) => ({
      position_index: d.position_index,
      orientation: d.orientation,
      card: cardById.get(d.card_id),
    }));

    // 5. readings, reading_cards 저장 (docs/02)
    const readingId = randomUUID();
    const { error: readingInsertError } = await supabase.from('readings').insert({
      id: readingId,
      session_id: sessionId,
      spread_id: spread.id,
      question: question && question.trim() ? question.trim() : null,
    });
    if (readingInsertError) throw readingInsertError;

    const { error: readingCardsInsertError } = await supabase.from('reading_cards').insert(
      draws.map((d) => ({
        reading_id: readingId,
        position_index: d.position_index,
        card_id: d.card_id,
        orientation: d.orientation,
      }))
    );
    if (readingCardsInsertError) throw readingCardsInsertError;

    // 6. AI 해석 생성 — 실패 시에도 카드 결과는 반환한다 (docs/03 §모호함 처리 기본값)
    let interpretation = null;
    try {
      const result = await generateInterpretation({ spread, question, drawnCards });
      await supabase.from('reading_interpretations').insert({
        reading_id: readingId,
        summary: result.summary,
        full_text: result.full_text,
        model_name: result.model_name,
      });
      interpretation = { summary: result.summary, full_text: result.full_text };
    } catch (aiError) {
      // eslint-disable-next-line no-console
      console.error('AI 해석 생성 실패:', aiError.message);
      interpretation = null;
    }

    res.status(200).json({
      reading_id: readingId,
      spread: { code: spread.code, position_labels: spread.position_labels },
      cards: drawnCards.map(({ position_index: positionIndex, orientation, card }) => ({
        position_index: positionIndex,
        card: { name_ko: card.name_ko, name_en: card.name_en, image_key: card.image_key },
        orientation,
        keywords: orientation === 'upright' ? card.upright_keywords : card.reversed_keywords,
      })),
      interpretation,
      interpretation_message: interpretation ? undefined : 'AI 해설을 불러오지 못했습니다. 다시 시도해주세요.',
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
