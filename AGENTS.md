# AGENTS.md — 작업 규칙 (AI 에이전트/개발자 공용)

이 문서는 이 저장소(`tarot-app/`)에서 코드를 작성하는 모든 주체(AI 코딩 에이전트, 사람 개발자)가 반드시 따라야 하는 규칙을 정의합니다.
**제품 요구사항(무엇을 만드는가)은 [`PRD.md`](./PRD.md)와 `docs/` 폴더에 있습니다. 이 문서는 "어떻게 작업하는가"만 다룹니다.**

> 원칙: 이 문서와 `PRD.md`, `docs/*.md`에 명시되지 않은 사항은 **추측해서 구현하지 않는다.** 아래 "모호한 요구사항 처리 원칙"을 따른다.

---

## 1. 기술 스택 (고정 — 임의 변경 금지)

| 영역 | 기술 | 비고 |
|---|---|---|
| Front-End | HTML, CSS, JavaScript (Vanilla) | React/Vue 등 프레임워크 **도입 금지**. 번들러(Vite 등)도 사용하지 않는다. |
| Back-End | Node.js | Vercel Serverless Functions(`/api/*.js`) 형태로 구현. Express 등 별도 프레임워크 **추가 설치 금지** (이유: `docs/06-deployment-and-ops.md` 참조). |
| AI | OpenAI API | 모델명은 환경변수 `OPENAI_MODEL`로 주입, 코드에 하드코딩 금지. |
| DB | Supabase (PostgreSQL) | 스키마는 `docs/02-database-schema.md`에 정의된 것만 사용. 임의 테이블 추가 금지. |
| 배포 | Vercel | 배포 절차는 `docs/06-deployment-and-ops.md` 참조. |

이 표에 없는 라이브러리/서비스(상태관리 라이브러리, CSS 프레임워크, ORM 등)를 새로 추가하려면 **먼저 사용자에게 확인**한다.

---

## 2. 저장소 목표 구조

```
tarot-app/
  AGENTS.md
  PRD.md
  docs/
    01-architecture.md
    02-database-schema.md
    03-backend-api-spec.md
    04-ai-interpretation-guide.md
    05-ui-ux-design-spec.md
    06-deployment-and-ops.md
  public/
    index.html
    styles/
      main.css
    scripts/
      main.js
      api-client.js
      background-animation.js
      card-deck.js
  api/
    cards.js
    spreads.js
    readings.js
    readings/[id].js
    readings/history.js
  lib/
    supabaseAdmin.js
    openaiClient.js
    rateLimit.js
    cardEngine.js
  data/
    seed-cards.json
    seed-spreads.json
  scripts/
    seed-database.js
  .env.example
  vercel.json
  package.json
  .gitignore
```

새 파일/폴더가 필요하면 이 구조에 맞춰 추가하되, 구조 자체를 바꾸는 경우(예: `api/`를 `server/`로 변경) 반드시 이유를 남기고 `docs/01-architecture.md`도 함께 갱신한다.

---

## 3. 반드시 지킬 것

1. **비밀키는 절대 클라이언트(HTML/JS)에 노출하지 않는다.** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 `api/`(서버) 코드에서만 참조한다. 프론트엔드에는 `SUPABASE_ANON_KEY`만 노출 가능.
2. **모든 카드 뽑기(랜덤)는 서버에서 수행한다.** 클라이언트에서 어떤 카드가 나올지 결정하거나 조작할 수 없어야 한다.
3. **AI 해석은 `docs/04-ai-interpretation-guide.md`에 정의된 그라운딩(참고자료 주입) 방식을 그대로 따른다.** 카드 의미를 모델이 자유 창작하도록 두지 않는다.
4. **환경변수는 `.env.example`에 키 이름만 등록**하고, 실제 값이 담긴 `.env`/`.env.local`은 절대 커밋하지 않는다 (`.gitignore`에 포함 확인).
5. **모바일 우선(mobile-first)으로 CSS를 작성**한다. 기준 뷰포트는 375px, 이후 데스크톱까지 확장.
6. 커밋은 논리적 단위로 나누고, 커밋 메시지는 "무엇을/왜"를 한 줄로 명확히 쓴다.
7. 새 기능을 추가하기 전, 해당 기능이 `PRD.md`의 기능 요구사항(FR) 번호와 대응되는지 확인한다. 대응되지 않으면 범위 외(out of scope)일 가능성이 높으므로 진행 전 확인한다.

---

## 4. 절대 하지 말 것 (금지 사항)

- 실제 결제/구독 기능 구현 (PRD 범위 외)
- 회원 인증을 MVP 단계에 임의로 추가하는 것 (PRD 6.2, 10장 "범위 외" 참조 — Phase 2로 명시적으로 분리되어 있음)
- OpenAI 응답을 사용자에게 "확정적 미래 예측/의료·법률·재정 조언"처럼 보이게 그대로 노출하는 것 — 반드시 `docs/04`의 안전 가이드라인(디스클레이머, 표현 제약)을 적용한다.
- 78장 카드 의미를 자체적으로 새로 작성/각색하는 것 — `data/seed-cards.json`에 정의된 표준 의미만 사용한다 (근거: `docs/04-ai-interpretation-guide.md` §신뢰성 기준).
- `--no-verify` 등으로 커밋 훅을 건너뛰는 것.
- 사용자 질문(질문 입력창)에 입력된 텍스트를 로그에 평문 저장하거나 제3자로 전송하는 것 (개인정보 취급 원칙, `docs/02` §개인정보 참조).

---

## 5. 모호한 요구사항 처리 원칙

작업 중 `PRD.md`나 `docs/*.md`에 답이 없는 결정이 필요하면, 다음 순서로 처리한다:

1. 같은 문서 내 "완료 기준" / "검증 기준" 절을 다시 확인한다 — 대부분의 모호함은 거기서 해소된다.
2. 그래도 없으면 **가장 단순하고 되돌리기 쉬운 기본값**을 적용하고, 코드 주석이 아니라 커밋 메시지 또는 PR 설명에 "왜 이 기본값을 택했는지"를 남긴다.
3. 되돌리기 어렵거나(예: DB 스키마 변경, 유료 API 호출량에 큰 영향을 주는 결정) 사용자 취향이 강하게 개입되는 사안(디자인 톤, 문구)은 **구현하지 말고 사용자에게 먼저 질문**한다.

---

## 6. 완료 정의 (Definition of Done) — 공통

어떤 기능이든 아래를 모두 만족해야 "완료"로 표시한다:

- [ ] 해당 기능의 PRD 기능 요구사항(FR) 항목의 완료 기준을 충족한다.
- [ ] 모바일 뷰(375px)와 데스크톱 뷰(1280px)에서 레이아웃이 깨지지 않는다.
- [ ] 브라우저 콘솔에 에러/경고가 없다.
- [ ] 서버 API는 정상 케이스와 최소 1개의 오류 케이스(잘못된 입력, OpenAI 실패 등)를 모두 처리한다.
- [ ] 비밀키가 클라이언트 번들/네트워크 응답에 노출되지 않는다 (브라우저 개발자도구 Network 탭으로 확인).
- [ ] 관련 `docs/*.md` 문서와 실제 구현이 어긋나지 않는다 (어긋나면 문서를 갱신).

## 7. 검증 절차 — 공통

1. 로컬에서 `vercel dev`(또는 프로젝트에 정의된 동등한 명령)로 실행해 수동 시나리오 테스트를 수행한다.
2. `docs/03-backend-api-spec.md`에 명시된 각 엔드포인트를 정상/오류 케이스로 최소 1회씩 호출해본다.
3. `docs/05-ui-ux-design-spec.md`의 "검증 체크리스트"에 따라 인터랙션(터치/스크롤/바텀시트)을 실제 모바일 폭에서 확인한다.
4. `docs/04-ai-interpretation-guide.md`의 "검증 기준"에 따라 AI 응답 샘플을 최소 5건 확인해 참고자료 밖 내용(환각)이 없는지 점검한다.

---

## 8. 문서 지도

- 제품 요구사항: [`PRD.md`](./PRD.md)
- 시스템 구조: [`docs/01-architecture.md`](./docs/01-architecture.md)
- DB 스키마: [`docs/02-database-schema.md`](./docs/02-database-schema.md)
- 백엔드 API 명세: [`docs/03-backend-api-spec.md`](./docs/03-backend-api-spec.md)
- AI 해석 가이드: [`docs/04-ai-interpretation-guide.md`](./docs/04-ai-interpretation-guide.md)
- UI/UX 디자인 명세: [`docs/05-ui-ux-design-spec.md`](./docs/05-ui-ux-design-spec.md)
- 배포/운영: [`docs/06-deployment-and-ops.md`](./docs/06-deployment-and-ops.md)
