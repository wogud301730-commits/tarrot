// 서버 전용 카드 랜덤 추첨 로직.
// AGENTS.md §3.2: 모든 카드 뽑기는 서버에서 수행하고 클라이언트는 결과를 조작할 수 없어야 한다.

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// allCardIds: 전체 78장의 id 배열, count: 스프레드가 요구하는 장수
// 반환: [{ position_index, card_id, orientation }], 카드 중복 없음, 정/역방향은 50/50 무작위(기본값)
function drawCards(allCardIds, count) {
  if (count > allCardIds.length) {
    throw new Error('요청한 카드 수가 전체 카드 수보다 많습니다.');
  }

  const selected = shuffle(allCardIds).slice(0, count);

  return selected.map((cardId, index) => ({
    position_index: index,
    card_id: cardId,
    orientation: Math.random() < 0.5 ? 'upright' : 'reversed',
  }));
}

module.exports = { drawCards };
