// 카드 비주얼(자체 제작 SVG, PRD §14 기본값) + 카드 덱 터치 인터랙션 (docs/05 §5, PRD FR-4)
window.TarotCardDeck = (function () {
  const GLYPHS = {
    major:
      '<svg viewBox="0 0 24 24" class="card-glyph"><path fill="currentColor" d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/></svg>',
    wands:
      '<svg viewBox="0 0 24 24" class="card-glyph"><path fill="currentColor" d="M12 3c-2.5 3-4 5.5-4 8a4 4 0 008 0c0-2.5-1.5-5-4-8z"/><rect x="11" y="14" width="2" height="8" fill="currentColor"/></svg>',
    cups:
      '<svg viewBox="0 0 24 24" class="card-glyph"><path fill="currentColor" d="M6 4h12l-1 6a5 5 0 01-10 0L6 4z"/><rect x="11" y="14" width="2" height="6" fill="currentColor"/><rect x="8" y="20" width="8" height="2" rx="1" fill="currentColor"/></svg>',
    swords:
      '<svg viewBox="0 0 24 24" class="card-glyph"><rect x="11" y="2" width="2" height="14" fill="currentColor"/><rect x="7" y="15" width="10" height="2" fill="currentColor"/><rect x="10.5" y="17" width="3" height="5" rx="1" fill="currentColor"/></svg>',
    pentacles:
      '<svg viewBox="0 0 24 24" class="card-glyph"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 5 L18 10 L15.5 17 L8.5 17 L6 10 Z" fill="currentColor" opacity="0.9"/></svg>',
  };

  const BACK_SVG =
    '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="none" stroke="#e8c77e" stroke-width="0.8" opacity="0.6"/><path d="M30 12 A18 18 0 1 0 30 48 A13 13 0 1 1 30 12 Z" fill="#e8c77e" opacity="0.8"/></svg>';

  function suitFromImageKey(imageKey) {
    if (!imageKey) return 'major';
    const prefix = imageKey.split('-')[0];
    return GLYPHS[prefix] ? prefix : 'major';
  }

  function glyphSvg(card) {
    return GLYPHS[suitFromImageKey(card.image_key)] || GLYPHS.major;
  }

  function orientationLabel(orientation) {
    return orientation === 'reversed' ? '역방향' : '정방향';
  }

  function renderFrontInner(cardData) {
    return (
      glyphSvg(cardData.card) +
      `<p class="card-name">${cardData.card.name_ko}</p>` +
      `<p class="card-orientation-badge">${orientationLabel(cardData.orientation)}</p>`
    );
  }

  // container: DOM 요소, count: 카드 장수, resultPromise: POST /api/readings 응답을 반환하는 Promise
  // onAllRevealed(result|null) : 사용자가 count장을 모두 뒤집은 뒤 호출됨 (result가 null이면 실패)
  function renderDeck(container, { count, resultPromise, onAllRevealed }) {
    container.innerHTML = '';
    let revealedCount = 0;
    const slots = [];

    for (let i = 0; i < count; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'card-slot';
      slot.setAttribute('role', 'listitem');
      slot.innerHTML =
        `<button type="button" class="card-flip" aria-label="카드 ${i + 1} 뒤집기">` +
        `<div class="card-face card-face-back">${BACK_SVG}</div>` +
        '<div class="card-face card-face-front"></div>' +
        '</button>';
      container.appendChild(slot);
      slots.push(slot);
    }

    let settledResult; // undefined = 대기 중, null = 실패, object = 성공
    resultPromise
      .then((r) => {
        settledResult = r;
      })
      .catch(() => {
        settledResult = null;
      });

    async function handleTap(slot) {
      const btn = slot.querySelector('button.card-flip');
      if (btn.classList.contains('is-disabled')) return;
      btn.classList.add('is-disabled');
      slot.classList.add('is-loading');

      // 서버 응답을 기다리는 동안 최소 300ms 글로우 연출 (docs/05 §5)
      await Promise.all([resultPromise.catch(() => null), new Promise((resolve) => setTimeout(resolve, 300))]);

      slot.classList.remove('is-loading');

      const positionIndex = revealedCount;
      const front = btn.querySelector('.card-face-front');

      if (!settledResult) {
        front.innerHTML = '<p class="card-name">불러오지 못했습니다</p>';
        btn.classList.add('is-flipped');
        revealedCount += 1;
        if (revealedCount === count && onAllRevealed) onAllRevealed(null);
        return;
      }

      const cardData = settledResult.cards[positionIndex];
      front.innerHTML = renderFrontInner(cardData);
      if (cardData.orientation === 'reversed') front.classList.add('is-reversed');
      btn.classList.add('is-flipped');

      revealedCount += 1;
      if (revealedCount === count && onAllRevealed) onAllRevealed(settledResult);
    }

    slots.forEach((slot) => {
      const btn = slot.querySelector('button.card-flip');
      btn.addEventListener('click', () => handleTap(slot));
    });
  }

  return { glyphSvg, orientationLabel, renderDeck };
})();
