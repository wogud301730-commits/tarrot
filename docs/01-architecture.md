# 01. 시스템 아키텍처

> 이 문서는 "코드가 어디에 있고, 어떻게 서로 연결되는가"를 정의합니다. 관련 상위 문서: [`../PRD.md`](../PRD.md) §8, [`../AGENTS.md`](../AGENTS.md) §2.

## 구현 범위 (Scope)

- 전체 시스템 구성도, 각 기술 요소의 역할, 요청/응답 흐름, 폴더 구조를 정의한다.
- 실제 코드 구현은 다루지 않는다 (엔드포인트 세부 사양은 `03`, DB는 `02`, AI는 `04`, UI는 `05`, 배포는 `06` 참조).

## 제약 조건 (Constraints)

- 프론트엔드는 빌드 도구(Webpack/Vite 등) 없이 브라우저에서 바로 실행되는 정적 HTML/CSS/JS여야 한다.
- 백엔드는 항상 켜져 있는 서버(Long-running server)가 아니라 **Vercel Serverless Functions**로 구현한다 (요청이 올 때만 실행). 이유: Vercel 배포와 자연스럽게 맞고, 트래픽이 적을 때 비용이 들지 않는다.
- 클라이언트는 Supabase에 **읽기 전용 공개 데이터(카드 사전)만 직접 접근**할 수 있고, 그 외 모든 쓰기/민감 로직은 반드시 `api/` 서버 코드를 거친다.

---

## 1. 전체 구성도 (텍스트 다이어그램)

```
[브라우저: HTML/CSS/JS]
   │
   └─ fetch('/api/...') — 모든 데이터 접근이 이 경로 하나로 통일됨
              │
              ▼
      [Vercel Serverless Functions = "Node.js 백엔드"]
        /api/cards.js         → 78장 카드 전체(요약+전문 의미) 반환
        /api/spreads.js       → 스프레드 목록 반환
        /api/readings.js      → 카드 뽑기 + AI 해석 생성 + 저장 (POST)
        /api/readings/[id].js → 특정 리딩 결과 조회 (GET)
        /api/readings/history.js → 세션의 최근 리딩 목록 (GET)
              │
              ├─ Supabase (service role key) : 읽기/쓰기 (RLS 우회, 서버 전용)
              │
              └─ OpenAI API : 카드 해석 텍스트 생성
```

> **데이터 접근 원칙 (M4에서 확정)**: `docs/02`는 `cards`/`spreads` 테이블에 대해 브라우저의 Supabase anon key 직접 접근도 허용하도록 RLS 정책을 열어두었지만(향후 확장 대비), 실제 구현에서는 **프론트엔드가 Supabase를 직접 호출하지 않는다.** 외부 CDN을 통한 Supabase JS 클라이언트 로딩 없이도 이미 `/api/cards`, `/api/spreads`로 필요한 모든 공개 데이터를 제공할 수 있어 단일 경로가 더 단순하고 일관적이기 때문이다 (AGENTS.md §5.2 "가장 단순한 기본값" 원칙 적용). 이에 따라 `lib/supabasePublic.js`는 만들지 않는다.

## 2. 컴포넌트별 역할

| 구성 요소 | 역할 |
|---|---|
| `public/index.html` + `styles/`, `scripts/` | 인트로 연출, 스프레드 선택, 카드 덱 인터랙션, 결과 화면, 카드 사전 UI 전체 |
| `api/*.js` | Vercel Serverless Function 진입점. 각 파일이 하나의 API 엔드포인트 |
| `lib/supabaseAdmin.js` | 서버 전용, service role key로 Supabase 접근 (RLS 우회) |
| `lib/openaiClient.js` | OpenAI API 호출 래퍼. 모델명/온도 등 설정을 한 곳에서 관리 |
| `lib/cardEngine.js` | 서버 측 카드 랜덤 추첨 로직 (정/역방향 포함), 시드 데이터 조합 |
| `lib/rateLimit.js` | 세션/IP 기준 요청 빈도 제한 |
| `data/seed-cards.json`, `data/seed-spreads.json` | 78장 카드 표준 의미, 스프레드 정의 원본 데이터 |
| `scripts/seed-database.js` | 위 JSON을 Supabase 테이블에 적재하는 1회성 스크립트 |

## 3. 요청 흐름 예시 — "3장 스프레드 리딩 생성"

1. 브라우저가 `POST /api/readings`에 `{ spread_code, question, session_id }` 전송
2. `api/readings.js`가 `lib/rateLimit.js`로 빈도 제한 확인
3. `lib/cardEngine.js`가 서버 내부에서 랜덤으로 카드 3장 + 정/역방향 결정
4. `lib/supabaseAdmin.js`로 각 카드의 표준 의미(`cards` 테이블) 조회
5. `lib/openaiClient.js`가 위 의미를 그라운딩 자료로 넣어 OpenAI 호출 (`docs/04` 방식)
6. 결과를 `readings`, `reading_cards`, `reading_interpretations` 테이블에 저장
7. 완성된 리딩 결과 JSON을 브라우저에 응답

## 완료 기준 (Definition of Done)

- [ ] 위 폴더 구조가 실제 저장소 구조와 정확히 일치한다.
- [ ] 브라우저 코드에서 `SUPABASE_SERVICE_ROLE_KEY` 또는 `OPENAI_API_KEY` 문자열이 검색되지 않는다.
- [ ] 모든 "쓰기" 작업(리딩 생성/저장)이 `api/` 경로를 통해서만 발생한다.

## 검증 기준 (Verification)

- 저장소 루트에서 `grep`으로 프론트엔드 파일(`public/**`) 내 `SERVICE_ROLE`, `sk-` 문자열이 없는지 확인한다.
- 브라우저 개발자도구 Network 탭에서 `/api/readings` 요청/응답에 비밀키가 포함되지 않는지 확인한다.
- `docs/01`의 구성도와 실제 `api/` 폴더 파일 목록을 비교해 1:1 대응하는지 확인한다.
