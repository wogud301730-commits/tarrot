# 03. 백엔드 API 명세 (Node.js / Vercel Serverless Functions)

> 상위 문서: [`../PRD.md`](../PRD.md) §5, [`01-architecture.md`](./01-architecture.md), [`02-database-schema.md`](./02-database-schema.md)

## 구현 범위 (Scope)

- `api/` 폴더 아래 각 엔드포인트의 요청/응답 형식, 오류 처리, 레이트리밋 규칙을 정의한다.

## 제약 조건 (Constraints)

- 모든 엔드포인트는 Vercel Serverless Function 규약(`export default function handler(req, res)`)을 따른다.
- 응답은 항상 JSON. 성공 시 데이터를 최상위에, 실패 시 `{ "error": { "code": string, "message": string } }` 형식으로 통일한다.
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 `api/`와 `lib/` 코드에서만 `process.env`로 읽는다.

---

## 엔드포인트 목록

### `GET /api/cards`
- 설명: 78장 카드 전체(요약 + 전문 의미)를 반환한다. 프론트엔드는 Supabase에 직접 접근하지 않고 항상 이 엔드포인트로 카드 데이터를 가져온다(`01-architecture.md` §데이터 접근 원칙 — M4에서 단일 경로로 단순화하기로 확정).
- 응답 200: `{ cards: [ { id, name_en, name_ko, arcana, suit, number, upright_keywords, reversed_keywords, upright_meaning, reversed_meaning, image_key } ] }`
- 78장 전체를 한 번에 내려줘도 텍스트 데이터만 포함되어 NFR-4(1MB 이하) 예산 안에 여유 있게 들어온다.

### `GET /api/spreads`
- 응답 200: `{ spreads: [ { id, code, name_ko, description, position_count, position_labels } ] }`

### `POST /api/readings`
- 설명: 카드 뽑기(서버 랜덤) + AI 해석 생성 + DB 저장을 한 번에 수행하는 핵심 엔드포인트.
- 요청 body:
  ```json
  {
    "spread_code": "three_card",
    "question": "이번 달 이직을 고민하고 있어요 (선택 입력, 없으면 빈 문자열)",
    "session_id": "브라우저가 생성한 UUID 문자열"
  }
  ```
- 처리 절차:
  1. `spread_code` 유효성 검사 (`spreads` 테이블에 존재하는지)
  2. `session_id` 존재 여부 및 레이트리밋 확인 (§레이트리밋)
  3. `lib/cardEngine.js`로 카드 N장 + 정/역방향 랜덤 결정 (중복 카드 없이)
  4. 각 카드의 표준 의미를 DB에서 조회
  5. OpenAI 호출 (`04-ai-interpretation-guide.md` 방식)
  6. `readings`, `reading_cards`, `reading_interpretations`에 저장
  7. 응답 반환
- 응답 200:
  ```json
  {
    "reading_id": "uuid",
    "spread": { "code": "three_card", "position_labels": ["과거","현재","미래"] },
    "cards": [
      { "position_index": 0, "card": { "name_ko": "...", "name_en": "...", "image_key": "..." }, "orientation": "upright", "keywords": ["..."] }
    ],
    "interpretation": { "summary": "...", "full_text": "..." },
    "disclaimer": "본 서비스는 오락 목적이며 의학적·법률적·재정적 조언을 대체하지 않습니다."
  }
  ```
- 오류 케이스:
  - 400: `spread_code` 누락/잘못됨, `question` 200자 초과
  - 429: 레이트리밋 초과 — `{ "error": { "code": "RATE_LIMITED", "message": "잠시 후 다시 시도해주세요." } }`
  - 502: OpenAI 호출 실패(타임아웃 20초 초과 포함) — 이 경우 DB에 리딩을 저장하지 않거나(트랜잭션 성격으로 처리), 카드 결과만이라도 저장하고 `interpretation`은 null과 함께 재시도 안내 문구를 반환한다 (아래 "모호함 처리" 참조).

  > **모호함 처리 기본값**: OpenAI 실패 시에도 카드 결과(어떤 카드가 나왔는지)는 사용자에게 보여주는 것이 UX상 낫다고 판단, `reading`과 `reading_cards`는 저장하고 `reading_interpretations`만 비워둔 뒤, 응답에 `interpretation: null`과 `"AI 해설을 불러오지 못했습니다. 다시 시도해주세요"` 메시지를 포함한다. 프론트엔드는 이 경우 "해설 다시 요청" 버튼을 노출한다.

### `GET /api/readings/:id`
- 설명: 특정 리딩 결과 재조회 (새로고침/공유 시 사용).
- 응답: `POST /api/readings` 성공 응답과 동일한 형식.
- 오류: 404 (존재하지 않는 id)

### `GET /api/readings/history?session_id=...`
- 설명: 특정 세션의 최근 리딩 목록 (최대 20건, 최신순).
- 응답 200: `{ readings: [ { reading_id, spread_code, created_at, summary } ] }`

---

## 레이트리밋

- 기준: 동일 `session_id` 기준, `POST /api/readings`는 **5분(300초)당 5회**까지.
- 구현: `lib/rateLimit.js`에서 Supabase의 `readings` 테이블에 최근 생성 시각을 조회해 카운트하거나, 별도 경량 저장소(예: Vercel KV) 사용. **MVP 기본값은 Supabase 조회 방식**으로 시작한다(추가 인프라 없이 구현 가능하므로).
- 초과 시 429 응답, `Retry-After` 헤더 포함.

## 완료 기준 (Definition of Done)

- [ ] 4개 엔드포인트가 위 명세대로 응답한다 (정상/오류 케이스 모두).
- [ ] `POST /api/readings`가 매 호출마다 서버에서 새로 카드를 랜덤 결정한다 (클라이언트가 카드 값을 지정할 방법이 없다).
- [ ] 레이트리밋이 실제로 6번째 요청부터 429를 반환한다.
- [ ] 모든 오류 응답이 `{ error: { code, message } }` 형식을 따른다.

## 검증 기준 (Verification)

- curl 또는 REST 클라이언트로 각 엔드포인트를 정상/오류 케이스 최소 1회씩 호출해 응답 스키마를 확인한다.
- 동일 `session_id`로 6회 연속 `POST /api/readings` 호출 시 6번째 응답이 429인지 확인한다.
- OpenAI API 키를 일시적으로 잘못된 값으로 바꿔 502 처리 및 "모호함 처리 기본값" 동작(카드는 반환, interpretation은 null)이 실제로 동작하는지 확인한다.
