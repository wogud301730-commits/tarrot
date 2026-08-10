// 화면 전환 및 전체 흐름 오케스트레이션 (PRD §4 핵심 사용자 플로우)
(function () {
  const screens = document.querySelectorAll('.screen');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const bottomSheet = document.getElementById('bottomSheet');
  const sheetBody = document.getElementById('sheetBody');
  const sheetHandle = document.getElementById('sheetHandle');
  const toastEl = document.getElementById('toast');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  const state = {
    spreads: null,
    cards: null,
    selectedSpread: null,
    question: '',
    dictionaryFilter: 'all',
    screenBeforeDictionary: 'intro',
  };

  // ── 화면 전환 ────────────────────────────────────────────
  function showScreen(name) {
    screens.forEach((el) => {
      el.hidden = el.dataset.screen !== name;
    });
    window.scrollTo(0, 0);
  }

  // ── 토스트 ──────────────────────────────────────────────
  let toastTimer = null;
  function showToast(message, duration = 3500) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, duration);
  }

  // ── 로딩 오버레이 ───────────────────────────────────────
  function showLoading(text) {
    loadingText.textContent = text || '불러오는 중...';
    loadingOverlay.hidden = false;
  }
  function hideLoading() {
    loadingOverlay.hidden = true;
  }

  // ── 바텀시트 (docs/05 §4: 드래그로 닫기 포함) ───────────
  let sheetDragStartY = null;
  let sheetDragCurrentY = 0;

  function openSheet(html) {
    sheetBody.innerHTML = html;
    bottomSheet.hidden = false;
    sheetBackdrop.hidden = false;
    // 다음 프레임에 클래스 부여 → CSS 트랜지션 적용
    requestAnimationFrame(() => {
      bottomSheet.classList.add('is-open');
      sheetBackdrop.classList.add('is-open');
    });
  }

  function closeSheet() {
    bottomSheet.classList.remove('is-open');
    sheetBackdrop.classList.remove('is-open');
    setTimeout(() => {
      bottomSheet.hidden = true;
      sheetBackdrop.hidden = true;
      bottomSheet.style.transform = '';
    }, 280);
  }

  sheetBackdrop.addEventListener('click', closeSheet);

  function onSheetDragStart(e) {
    sheetDragStartY = e.clientY;
    bottomSheet.style.transition = 'none';
  }
  function onSheetDragMove(e) {
    if (sheetDragStartY === null) return;
    sheetDragCurrentY = Math.max(0, e.clientY - sheetDragStartY);
    bottomSheet.style.transform = `translate(-50%, ${sheetDragCurrentY}px)`;
  }
  function onSheetDragEnd() {
    if (sheetDragStartY === null) return;
    bottomSheet.style.transition = '';
    const threshold = bottomSheet.offsetHeight * 0.3;
    if (sheetDragCurrentY > threshold) {
      closeSheet();
    } else {
      bottomSheet.style.transform = '';
    }
    sheetDragStartY = null;
    sheetDragCurrentY = 0;
  }

  sheetHandle.addEventListener('pointerdown', (e) => {
    onSheetDragStart(e);
    sheetHandle.setPointerCapture(e.pointerId);
  });
  sheetHandle.addEventListener('pointermove', onSheetDragMove);
  sheetHandle.addEventListener('pointerup', onSheetDragEnd);
  sheetHandle.addEventListener('pointercancel', onSheetDragEnd);

  // ── 데이터 로딩 (캐시) ──────────────────────────────────
  async function ensureSpreads() {
    if (!state.spreads) {
      const res = await window.TarotAPI.fetchSpreads();
      state.spreads = res.spreads;
    }
    return state.spreads;
  }

  async function ensureCards() {
    if (!state.cards) {
      const res = await window.TarotAPI.fetchCards();
      state.cards = res.cards;
    }
    return state.cards;
  }

  // ── 1. 스프레드 선택 시트 ───────────────────────────────
  async function openSpreadSheet() {
    let spreads;
    try {
      spreads = await ensureSpreads();
    } catch (err) {
      showToast('스프레드 정보를 불러오지 못했습니다. 다시 시도해주세요.');
      return;
    }

    let selectedCode = spreads[0]?.code;

    function renderOptions() {
      return spreads
        .map(
          (s) => `
        <button type="button" class="sheet-option ${s.code === selectedCode ? 'is-selected' : ''}" data-code="${s.code}">
          <span class="radio-dot"></span>
          <span class="sheet-option-text">
            <span class="sheet-option-title">${s.name_ko}</span>
            <span class="sheet-option-desc">${s.description}</span>
          </span>
        </button>`
        )
        .join('');
    }

    openSheet(`
      <h3>스프레드를 선택하세요</h3>
      <p class="sheet-description">카드를 몇 장 뽑을지 골라주세요.</p>
      <div class="sheet-option-list" id="spreadOptionList">${renderOptions()}</div>
      <button type="button" class="cta-pill" id="spreadNextBtn">다음</button>
    `);

    const list = document.getElementById('spreadOptionList');
    list.addEventListener('click', (e) => {
      const optionBtn = e.target.closest('.sheet-option');
      if (!optionBtn) return;
      selectedCode = optionBtn.dataset.code;
      list.innerHTML = renderOptions();
    });

    document.getElementById('spreadNextBtn').addEventListener('click', () => {
      state.selectedSpread = spreads.find((s) => s.code === selectedCode);
      closeSheet();
      setTimeout(openQuestionSheet, 300);
    });
  }

  // ── 2. 질문 입력 시트 ───────────────────────────────────
  function openQuestionSheet() {
    const MAX = 200;
    openSheet(`
      <h3>궁금한 것이 있나요?</h3>
      <p class="sheet-description">선택 입력이에요. 비워두고 진행해도 괜찮아요.</p>
      <textarea class="sheet-textarea" id="questionInput" maxlength="${MAX}" placeholder="예) 요즘 고민하고 있는 이직에 대해 알고 싶어요"></textarea>
      <p class="sheet-char-count" id="questionCharCount">0 / ${MAX}</p>
      <button type="button" class="cta-pill" id="questionNextBtn">카드 뽑으러 가기</button>
    `);

    const textarea = document.getElementById('questionInput');
    const charCount = document.getElementById('questionCharCount');
    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length} / ${MAX}`;
    });

    document.getElementById('questionNextBtn').addEventListener('click', () => {
      state.question = textarea.value.trim();
      closeSheet();
      setTimeout(startDeckScreen, 300);
    });
  }

  // ── 3. 카드 덱 화면 ─────────────────────────────────────
  function startDeckScreen() {
    const spread = state.selectedSpread;
    document.getElementById('deckSpreadName').textContent = spread.name_ko;
    showScreen('deck');

    const resultPromise = window.TarotAPI.postReading({
      spreadCode: spread.code,
      question: state.question,
    });

    window.TarotCardDeck.renderDeck(document.getElementById('cardRow'), {
      count: spread.position_count,
      resultPromise,
      onAllRevealed: (result) => {
        if (!result) {
          showToast('리딩 결과를 불러오지 못했습니다. 뒤로 가서 다시 시도해주세요.');
          return;
        }
        setTimeout(() => renderResultScreen(result), 500);
      },
    });
  }

  document.getElementById('deckBackBtn').addEventListener('click', () => showScreen('intro'));

  // ── 4. 결과 화면 ────────────────────────────────────────
  function renderResultScreen(result) {
    const cardsHtml = result.cards
      .map((c) => {
        const label = result.spread.position_labels[c.position_index] || `${c.position_index + 1}`;
        return `
        <div class="result-card ${c.orientation === 'reversed' ? 'is-reversed' : ''}" role="listitem">
          <p class="result-card-position">${label}</p>
          ${window.TarotCardDeck.glyphSvg(c.card)}
          <p class="result-card-name">${c.card.name_ko}</p>
          <p class="result-card-orientation">${window.TarotCardDeck.orientationLabel(c.orientation)}</p>
        </div>`;
      })
      .join('');

    document.getElementById('resultCards').innerHTML = cardsHtml;

    const interpretationEl = document.getElementById('resultInterpretation');
    if (result.crisis) {
      interpretationEl.innerHTML = `<p>${result.message}</p>`;
    } else if (result.interpretation) {
      interpretationEl.innerHTML =
        `<p class="interpretation-summary">${result.interpretation.summary}</p>` +
        `<p>${result.interpretation.full_text}</p>`;
    } else {
      interpretationEl.innerHTML = `<p>${result.interpretation_message || 'AI 해설을 불러오지 못했습니다.'}</p>`;
    }

    document.getElementById('resultDisclaimer').textContent = result.disclaimer || '';
    showScreen('result');
  }

  document.getElementById('restartBtn').addEventListener('click', () => {
    state.selectedSpread = null;
    state.question = '';
    showScreen('intro');
  });
  document.getElementById('resultBackBtn').addEventListener('click', () => showScreen('intro'));

  // ── 5. 카드 사전 ────────────────────────────────────────
  const FILTERS = [
    { key: 'all', label: '전체' },
    { key: 'major', label: '메이저' },
    { key: 'wands', label: '완드' },
    { key: 'cups', label: '컵' },
    { key: 'swords', label: '소드' },
    { key: 'pentacles', label: '펜타클' },
  ];

  function matchesFilter(card, filterKey) {
    if (filterKey === 'all') return true;
    if (filterKey === 'major') return card.arcana === 'major';
    return card.suit === filterKey;
  }

  function renderDictionaryGrid() {
    const grid = document.getElementById('cardGrid');
    const filtered = state.cards.filter((c) => matchesFilter(c, state.dictionaryFilter));
    grid.innerHTML = filtered
      .map(
        (c) => `
      <button type="button" class="card-grid-item" role="listitem" data-card-id="${c.id}">
        ${window.TarotCardDeck.glyphSvg(c)}
        <span class="card-grid-name">${c.name_ko}</span>
      </button>`
      )
      .join('');
  }

  function renderFilterPills() {
    const container = document.getElementById('filterPills');
    container.innerHTML = FILTERS.map(
      (f) => `<button type="button" class="filter-pill ${f.key === state.dictionaryFilter ? 'is-active' : ''}" data-key="${f.key}" role="tab">${f.label}</button>`
    ).join('');
  }

  async function openDictionary(fromScreen) {
    state.screenBeforeDictionary = fromScreen;
    showScreen('dictionary');

    if (!state.cards) {
      showLoading('카드를 불러오는 중...');
      try {
        await ensureCards();
      } catch (err) {
        hideLoading();
        showToast('카드 사전을 불러오지 못했습니다.');
        showScreen(fromScreen);
        return;
      }
      hideLoading();
    }

    renderFilterPills();
    renderDictionaryGrid();
  }

  document.getElementById('filterPills').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    state.dictionaryFilter = pill.dataset.key;
    renderFilterPills();
    renderDictionaryGrid();
  });

  document.getElementById('cardGrid').addEventListener('click', (e) => {
    const item = e.target.closest('.card-grid-item');
    if (!item) return;
    const card = state.cards.find((c) => String(c.id) === item.dataset.cardId);
    if (card) openCardDetailSheet(card);
  });

  function openCardDetailSheet(card) {
    openSheet(`
      <h3>${card.name_ko}</h3>
      <p class="sheet-description">${card.name_en}</p>
      <div class="sheet-detail-meaning">
        <h4>정방향</h4>
        <div class="sheet-keyword-tags">${card.upright_keywords.map((k) => `<span class="sheet-keyword-tag">${k}</span>`).join('')}</div>
        <p>${card.upright_meaning}</p>
      </div>
      <div class="sheet-detail-meaning">
        <h4>역방향</h4>
        <div class="sheet-keyword-tags">${card.reversed_keywords.map((k) => `<span class="sheet-keyword-tag">${k}</span>`).join('')}</div>
        <p>${card.reversed_meaning}</p>
      </div>
    `);
  }

  document.getElementById('dictionaryCloseBtn').addEventListener('click', () => {
    showScreen(state.screenBeforeDictionary);
  });
  document.getElementById('openDictionaryBtn').addEventListener('click', () => openDictionary('intro'));
  document.getElementById('openDictionaryFromResultBtn').addEventListener('click', () => openDictionary('result'));

  // ── 6. 지난 리딩(히스토리) 시트 — PRD FR-8 ──────────────
  document.getElementById('openHistoryBtn').addEventListener('click', async () => {
    openSheet('<h3>지난 리딩</h3><p class="sheet-description">불러오는 중...</p>');
    let history;
    try {
      const res = await window.TarotAPI.fetchHistory();
      history = res.readings;
    } catch (err) {
      sheetBody.innerHTML = '<h3>지난 리딩</h3><p class="sheet-empty">불러오지 못했습니다.</p>';
      return;
    }

    if (!history.length) {
      sheetBody.innerHTML = '<h3>지난 리딩</h3><p class="sheet-empty">아직 리딩 기록이 없습니다.</p>';
      return;
    }

    sheetBody.innerHTML =
      '<h3>지난 리딩</h3><div class="sheet-history-list">' +
      history
        .map(
          (r) => `
        <button type="button" class="sheet-history-item" data-id="${r.reading_id}">
          <p class="history-date">${new Date(r.created_at).toLocaleString('ko-KR')}</p>
          <p class="history-summary">${r.summary || '해설 없음'}</p>
        </button>`
        )
        .join('') +
      '</div>';

    sheetBody.querySelectorAll('.sheet-history-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        closeSheet();
        showLoading('리딩을 불러오는 중...');
        try {
          const full = await window.TarotAPI.fetchReadingById(btn.dataset.id);
          hideLoading();
          renderResultScreen(full);
        } catch (err) {
          hideLoading();
          showToast('리딩을 불러오지 못했습니다.');
        }
      });
    });
  });

  // ── 인트로 시작 ─────────────────────────────────────────
  document.getElementById('introStartBtn').addEventListener('click', openSpreadSheet);

  // ── 초기화 ──────────────────────────────────────────────
  window.TarotBackground.init();
  showScreen('intro');
})();
