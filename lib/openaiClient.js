// docs/04-ai-interpretation-guide.md 그라운딩 프롬프트 구조 구현.
// 카드 의미는 항상 호출자가 DB에서 조회해 전달한다 — 이 파일은 새로운 카드 의미를 만들지 않는다.

const OpenAI = require('openai');

const SYSTEM_PROMPT = `당신은 타로 해설가입니다. 아래 [참고자료]에 주어진 카드 의미만을 근거로 해설하세요.
[참고자료]에 없는 새로운 상징이나 의미를 임의로 만들어내지 마세요.
확정적인 예언(예: "반드시 ~할 것이다", 죽음/질병/사고/이혼 등 단정적 부정 표현)은 쓰지 말고,
성찰과 가능성을 제안하는 어조로 작성하세요.
의학적·법률적·재정적 조언으로 해석될 수 있는 단정적 문장은 피하세요.
모든 텍스트는 자연스러운 한국어로만 작성하고, 다른 언어의 문자를 섞지 마세요.
반드시 다음 JSON 형식으로만 답하세요. 다른 설명을 덧붙이지 마세요:
{"summary": "한 문장 종합 메시지", "per_card": [{"position_index": 0, "text": "해당 카드 해설 2~4문장"}], "overall_message": "전체를 종합한 3~5문장 해설"}`;

const DISCLAIMER = '본 서비스는 오락 목적이며 의학적·법률적·재정적 조언을 대체하지 않습니다.';

// docs/04 §안전 가이드라인: 위기 신호 1차 필터링 (완벽한 탐지를 보장하지 않음)
const CRISIS_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '자해', '살고싶지 않', '살고 싶지 않'];

const CRISIS_RESPONSE_MESSAGE =
  '지금 많이 힘든 마음이 느껴져요. 타로 해석보다 지금 이 순간 마음을 나눌 수 있는 도움이 더 필요할 수 있습니다. ' +
  '자살예방상담전화 1393, 정신건강 위기상담전화 1577-0199 등 전문기관에 연락해 이야기를 나눠보시길 권합니다.';

function containsCrisisSignal(text) {
  if (!text) return false;
  return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function buildUserPrompt({ spread, question, drawnCards }) {
  const cardLines = drawnCards
    .map(({ position_index: positionIndex, card, orientation }) => {
      const label = spread.position_labels[positionIndex] || `${positionIndex + 1}번 위치`;
      const isUpright = orientation === 'upright';
      const meaning = isUpright ? card.upright_meaning : card.reversed_meaning;
      const keywords = isUpright ? card.upright_keywords : card.reversed_keywords;
      return (
        `${positionIndex + 1}번 위치(${label}): ${card.name_ko} (${isUpright ? '정방향' : '역방향'})\n` +
        `  키워드: ${keywords.join(', ')}\n` +
        `  표준 의미: ${meaning}`
      );
    })
    .join('\n');

  const questionLine = question && question.trim() ? question.trim() : '질문 없음';

  return (
    `[스프레드]: ${spread.name_ko} (${spread.position_labels.join(', ')})\n` +
    `[사용자 질문]: ${questionLine}\n\n` +
    `[참고자료]\n${cardLines}\n\n` +
    '위 참고자료를 바탕으로 앞서 안내된 JSON 형식으로만 답하세요.'
  );
}

let cachedClient = null;
function getOpenAIClient() {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

// drawnCards: [{ position_index, orientation, card: <cards 테이블 row> }]
// 반환: { summary, full_text, per_card, model_name }
async function generateInterpretation({ spread, question, drawnCards }) {
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const completion = await openai.chat.completions.create(
    {
      model,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt({ spread, question, drawnCards }) },
      ],
    },
    { timeout: 20000 } // docs/04 §타임아웃: 20초
  );

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI 응답이 비어 있습니다.');
  }

  const parsed = JSON.parse(raw); // 형식이 어긋나면 예외 발생 → 호출자가 502/재시도 처리

  const fullText = [parsed.overall_message, ...(parsed.per_card || []).map((p) => p.text)]
    .filter(Boolean)
    .join('\n\n');

  return {
    summary: parsed.summary || '',
    full_text: fullText,
    per_card: parsed.per_card || [],
    model_name: model,
  };
}

module.exports = {
  generateInterpretation,
  containsCrisisSignal,
  DISCLAIMER,
  CRISIS_RESPONSE_MESSAGE,
};
