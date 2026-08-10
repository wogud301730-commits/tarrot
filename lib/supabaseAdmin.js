const { createClient } = require('@supabase/supabase-js');

// 서버 전용 관리자 클라이언트 — service_role 키로 RLS를 우회한다.
// AGENTS.md §3.1: 이 모듈은 api/ 와 scripts/ 에서만 import 한다. 프론트엔드(public/)에서 사용 금지.
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. .env.local (로컬) 또는 Vercel 프로젝트 환경변수(배포)를 확인하세요.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

module.exports = { getSupabaseAdmin };
