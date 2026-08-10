# 02. 데이터베이스 스키마 (Supabase / PostgreSQL)

> 상위 문서: [`../PRD.md`](../PRD.md) §5(FR-7, FR-8), [`01-architecture.md`](./01-architecture.md)

## 구현 범위 (Scope)

- Supabase에 생성할 테이블, 컬럼, 관계, RLS(Row Level Security) 정책을 정의한다.
- 78장 카드 및 스프레드의 초기 시드 데이터 규칙을 정의한다.

## 제약 조건 (Constraints)

- 이 문서에 정의되지 않은 테이블/컬럼을 임의로 추가하지 않는다. 필요하면 이 문서를 먼저 갱신한다.
- 개인식별정보(PII)는 저장하지 않는다. `session_id`는 브라우저가 생성한 무작위 UUID일 뿐, 이메일/이름/IP를 컬럼으로 저장하지 않는다.
- 모든 테이블은 RLS를 **활성화(enable)** 한다. 기본은 "거부(deny)"이며, 명시적으로 허용한 것만 예외로 둔다.

---

## 1. 테이블 정의

### `cards` (78개 행 — 공개 참고자료)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial (PK) | |
| `name_en` | text | 영문 카드명 (예: "The Fool") |
| `name_ko` | text | 한글 카드명 (예: "바보") |
| `arcana` | text | `major` \| `minor` |
| `suit` | text (nullable) | `wands`\|`cups`\|`swords`\|`pentacles`, 메이저는 null |
| `number` | int | 카드 번호 |
| `upright_keywords` | text[] | 정방향 키워드 3~5개 |
| `reversed_keywords` | text[] | 역방향 키워드 3~5개 |
| `upright_meaning` | text | 정방향 표준 의미 (2~4문장) |
| `reversed_meaning` | text | 역방향 표준 의미 (2~4문장) |
| `image_key` | text | 프론트엔드 SVG/아이콘 매핑용 키 (실제 이미지 파일 아님, `docs/05` 참조) |

### `spreads` (2개 행)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial (PK) | |
| `code` | text unique | `single` \| `three_card` |
| `name_ko` | text | 화면 표시용 이름 |
| `description` | text | 짧은 설명 |
| `position_count` | int | 카드 장수 |
| `position_labels` | text[] | 예: `['과거','현재','미래']`, single은 `['오늘의 카드']` |

### `readings`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK, default gen_random_uuid()) | |
| `session_id` | text | 브라우저가 생성한 익명 UUID (PII 아님) |
| `spread_id` | int (FK → spreads.id) | |
| `question` | text (nullable) | 사용자가 입력한 질문 (최대 200자) |
| `created_at` | timestamptz default now() | |

### `reading_cards`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial (PK) | |
| `reading_id` | uuid (FK → readings.id, on delete cascade) | |
| `position_index` | int | 0부터 시작, 스프레드 내 위치 |
| `card_id` | int (FK → cards.id) | |
| `orientation` | text | `upright` \| `reversed` |

### `reading_interpretations`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial (PK) | |
| `reading_id` | uuid (FK → readings.id, unique, on delete cascade) | |
| `summary` | text | 한 줄 종합 메시지 |
| `full_text` | text | 카드별 해설 + 종합 해설 전체 |
| `model_name` | text | 실제 호출한 OpenAI 모델명 (감사/추적용) |
| `created_at` | timestamptz default now() | |

> Phase 2(로그인 도입 시)에만 `profiles` 테이블을 추가한다. MVP에서는 생성하지 않는다 (`../PRD.md` §10).

## 2. 관계도 (텍스트)

```
spreads 1 ──< readings >── 1 reading_interpretations
                 │
                 └──< reading_cards >── 1 cards
```

## 3. RLS(Row Level Security) 정책

| 테이블 | RLS | 정책 |
|---|---|---|
| `cards` | ON | `anon` role에 **SELECT만 허용** (공개 참고자료). INSERT/UPDATE/DELETE는 정책 없음 → 자동 거부. |
| `spreads` | ON | `cards`와 동일 (SELECT만 anon 허용). |
| `readings`, `reading_cards`, `reading_interpretations` | ON | **정책 없음** → `anon`/`authenticated` 모두 거부. 오직 서버(`service_role`, RLS 우회)만 접근. |

이렇게 하는 이유: 세션 기반 접근 제어를 PostgreSQL RLS 정책으로 정교하게 구현하는 대신, "리딩 관련 데이터는 항상 서버를 거친다"는 단순한 규칙으로 대체해 실수 가능성을 줄인다 (`01-architecture.md` §2 원칙과 일치).

## 4. 시드 데이터 규칙

- `data/seed-cards.json`: 78장 전체(메이저 22 + 마이너 56)를 포함해야 한다. 각 카드는 위 컬럼을 모두 채운다.
- 의미(`upright_meaning`, `reversed_meaning`)는 라이더-웨이트 계열의 널리 통용되는 표준 해설을 기반으로 작성하고, **최소 2개 이상의 서로 다른 공신력 있는 공개 타로 레퍼런스 자료와 대조**하여 서로 모순되지 않는 내용만 채택한다 (`04-ai-interpretation-guide.md` §신뢰성 기준과 연동).
- `data/seed-spreads.json`: `single`, `three_card` 2개 행 포함.
- `scripts/seed-database.js`는 **idempotent**(여러 번 실행해도 중복 삽입되지 않음)해야 한다 — `upsert`를 사용하고 unique key(`cards.name_en`, `spreads.code`)를 기준으로 한다.

## 5. 개인정보 취급 원칙

- `question` 컬럼에 사용자가 민감한 개인정보를 직접 입력할 가능성이 있으므로, 별도의 분석/로깅 목적으로 이 컬럼을 외부로 내보내거나 제3자 로그 서비스에 전달하지 않는다.
- `session_id`만으로 실존 인물을 특정할 수 없어야 하며, 이메일/전화번호/이름 컬럼을 추가하지 않는다 (MVP 기준).

## 완료 기준 (Definition of Done)

- [ ] 위 5개 테이블이 Supabase에 생성되어 있다.
- [ ] `cards` 테이블 행 수 = 78, `spreads` 테이블 행 수 = 2.
- [ ] 5개 테이블 모두 RLS가 활성화되어 있다.
- [ ] `scripts/seed-database.js`를 2번 연속 실행해도 행이 중복되지 않는다.

## 검증 기준 (Verification)

- Supabase 대시보드에서 각 테이블의 RLS 상태(ON)와 정책 목록을 스크린샷 또는 SQL(`select * from pg_policies`)로 확인한다.
- `anon` key로 `readings` 테이블에 직접 SELECT를 시도했을 때 빈 결과 또는 권한 오류가 반환되는지 확인한다.
- `anon` key로 `cards` 테이블 SELECT 시 78개 행이 정상적으로 반환되는지 확인한다.
