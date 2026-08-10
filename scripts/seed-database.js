// docs/02-database-schema.md §4 시드 데이터 규칙: 여러 번 실행해도 중복 삽입되지 않도록(idempotent)
// cards는 name_en, spreads는 code를 기준으로 upsert 한다.
// 실행 전 scripts/schema.sql이 Supabase에 적용되어 있어야 한다.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const cards = require('../data/seed-cards.json');
const spreads = require('../data/seed-spreads.json');
const { getSupabaseAdmin } = require('../lib/supabaseAdmin');

async function seedSpreads(supabase) {
  const { error } = await supabase.from('spreads').upsert(spreads, { onConflict: 'code' });
  if (error) throw new Error(`spreads 시딩 실패: ${error.message}`);
  console.log(`spreads: ${spreads.length}개 upsert 완료`);
}

async function seedCards(supabase) {
  const { error } = await supabase.from('cards').upsert(cards, { onConflict: 'name_en' });
  if (error) throw new Error(`cards 시딩 실패: ${error.message}`);
  console.log(`cards: ${cards.length}개 upsert 완료`);
}

async function verify(supabase) {
  const { count: cardCount, error: cardErr } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });
  const { count: spreadCount, error: spreadErr } = await supabase
    .from('spreads')
    .select('*', { count: 'exact', head: true });

  if (cardErr) throw new Error(`cards 카운트 조회 실패: ${cardErr.message}`);
  if (spreadErr) throw new Error(`spreads 카운트 조회 실패: ${spreadErr.message}`);

  console.log(`검증 — cards 테이블 행 수: ${cardCount} (기대값 78)`);
  console.log(`검증 — spreads 테이블 행 수: ${spreadCount} (기대값 2)`);

  // docs/02-database-schema.md §완료 기준
  if (cardCount !== 78) {
    console.warn('경고: cards 테이블 행 수가 78이 아닙니다.');
  }
  if (spreadCount !== 2) {
    console.warn('경고: spreads 테이블 행 수가 2가 아닙니다.');
  }
}

async function main() {
  const supabase = getSupabaseAdmin();
  await seedSpreads(supabase);
  await seedCards(supabase);
  await verify(supabase);
}

main().catch((err) => {
  console.error('시딩 실패:', err.message);
  process.exit(1);
});
