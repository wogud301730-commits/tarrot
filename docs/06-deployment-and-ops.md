# 06. 배포 및 운영 (Vercel)

> 상위 문서: [`../PRD.md`](../PRD.md) §11(M5), [`01-architecture.md`](./01-architecture.md)

## 구현 범위 (Scope)

- Vercel 배포 절차, 필요한 환경변수 목록, Supabase 연동 설정, 배포 후 확인 절차를 정의한다.

## 제약 조건 (Constraints)

- 백엔드를 별도 Express 서버로 만들어 Vercel 밖(예: 별도 VM)에 올리지 않는다 — `api/` 폴더의 Vercel Serverless Functions 방식만 사용한다 (`01-architecture.md`).
- 모든 비밀값은 Vercel 프로젝트의 Environment Variables 설정에만 저장하고 코드/커밋에 남기지 않는다.

---

## 1. 왜 Express 없이 Vercel Serverless Functions인가

Node.js 백엔드 요구사항은 "Express 프레임워크"를 의미하지 않습니다. Vercel은 `api/` 폴더의 각 `.js` 파일을 자동으로 하나의 서버리스 함수(HTTP 엔드포인트)로 배포하므로, 별도 프레임워크 설치 없이 순수 Node.js 핸들러만으로 백엔드 요구사항을 충족할 수 있습니다. 이는 배포 설정을 단순화하고, 트래픽이 없을 때 비용이 발생하지 않는 장점이 있습니다.

## 2. 환경변수 목록

| 변수명 | 사용 위치 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | 서버(`api/`, `lib/`) | OpenAI 인증키. 절대 클라이언트 노출 금지. |
| `OPENAI_MODEL` | 서버 | 사용할 모델명 (기본값 예: 비용 효율 모델) |
| `SUPABASE_URL` | 서버 + 클라이언트(공개값) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 | RLS 우회 관리자 키. 절대 클라이언트 노출 금지. |
| `SUPABASE_ANON_KEY` | 클라이언트(공개 가능) | 카드 사전 등 공개 데이터 조회용 |
| `SITE_NAME` | 클라이언트/서버 공통 | 화면 표시용 서비스명 (가칭 "루나타로" 등 쉽게 교체) |

`.env.example`에는 위 6개 키 이름만 값 없이 등록한다. 실제 값은 로컬에서는 `.env.local`(Git 추적 제외), Vercel에서는 프로젝트 Settings → Environment Variables에 등록한다.

## 3. 배포 절차

1. Supabase 프로젝트 생성 → `02-database-schema.md`의 테이블/RLS 정책 적용 (SQL 마이그레이션 또는 대시보드에서 직접 생성).
2. `node scripts/seed-database.js` 로컬 실행 → `cards`, `spreads` 테이블 시드 확인.
3. GitHub(또는 사용 중인 Git 원격 저장소)에 `tarot-app/` 푸시.
4. Vercel에서 해당 저장소를 Import → 위 환경변수 6개 등록.
5. 배포(Deploy) 실행 → Preview URL에서 1차 확인.
6. 문제 없으면 Production 배포(도메인 연결은 선택 사항).

## 4. 배포 후 검증 절차 (Smoke Test)

- [ ] Production URL 접속 시 인트로 화면이 정상 렌더링된다.
- [ ] `GET /api/spreads` 호출 시 200과 2개 스프레드가 반환된다.
- [ ] 스프레드 선택 → 카드 뽑기 → 결과까지 전체 플로우가 오류 없이 동작한다.
- [ ] 브라우저 Network 탭에서 `SUPABASE_SERVICE_ROLE_KEY`/`OPENAI_API_KEY` 값이 어떤 응답에도 포함되지 않는다.
- [ ] 카드 사전 화면에서 78장이 모두 로드된다.

## 5. 비용/레이트리밋 모니터링

- OpenAI 대시보드에서 일별 호출량/비용을 주기적으로 확인한다 (자동화된 알림 설정은 MVP 범위 밖, 수동 확인으로 시작).
- `03-backend-api-spec.md`의 레이트리밋(세션당 5분 5회)이 프로덕션에서도 동일하게 적용되는지 배포 후 1회 확인한다.
- Supabase 무료 티어 사용량(행 수, 대역폭) 한도를 초과하지 않는지 주기적으로 확인한다.

## 완료 기준 (Definition of Done)

- [ ] Vercel Production 배포 URL이 존재하고 §4 스모크 테스트를 모두 통과한다.
- [ ] 6개 환경변수가 Vercel 프로젝트 설정에 등록되어 있고, 코드/Git 히스토리에는 값이 존재하지 않는다.
- [ ] `.env.example`과 실제 필요한 환경변수 목록이 정확히 일치한다.

## 검증 기준 (Verification)

- 저장소 전체를 대상으로 `git log -p`에서 API 키 패턴(`sk-`, Supabase JWT 형식)이 커밋된 적 없는지 확인한다.
- Vercel 배포 로그에서 빌드/함수 배포가 오류 없이 완료되었는지 확인한다.
- 스모크 테스트(§4) 체크리스트를 실제로 프로덕션 URL에서 수행하고 결과를 기록한다.
