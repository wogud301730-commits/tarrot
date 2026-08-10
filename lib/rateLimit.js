// docs/03-backend-api-spec.md §레이트리밋: 동일 session_id 기준 5분당 5회까지.
// MVP 기본값: 별도 인프라(Vercel KV 등) 없이 readings 테이블 조회로 구현.

const WINDOW_SECONDS = 5 * 60;
const MAX_REQUESTS = 5;

async function checkRateLimit(supabase, sessionId) {
  const sinceIso = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

  const { count, error } = await supabase
    .from('readings')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .gte('created_at', sinceIso);

  if (error) {
    throw new Error(`레이트리밋 확인 실패: ${error.message}`);
  }

  return {
    allowed: (count ?? 0) < MAX_REQUESTS,
    retryAfterSeconds: WINDOW_SECONDS,
  };
}

module.exports = { checkRateLimit, MAX_REQUESTS, WINDOW_SECONDS };
