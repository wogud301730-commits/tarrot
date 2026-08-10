// 서버 API 호출 래퍼 + 익명 세션 ID 관리 (PRD FR-8, docs/03)
window.TarotAPI = (function () {
  const SESSION_KEY = 'tarot_session_id';

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  async function request(path, options) {
    const res = await fetch(path, options);
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }

    if (!res.ok) {
      const message = body?.error?.message || `요청에 실패했습니다 (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      error.code = body?.error?.code;
      throw error;
    }

    return body;
  }

  function fetchCards() {
    return request('/api/cards');
  }

  function fetchSpreads() {
    return request('/api/spreads');
  }

  function postReading({ spreadCode, question }) {
    return request('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spread_code: spreadCode,
        question: question || '',
        session_id: getSessionId(),
      }),
    });
  }

  function fetchReadingById(id) {
    return request(`/api/readings/${encodeURIComponent(id)}`);
  }

  function fetchHistory() {
    return request(`/api/readings/history?session_id=${encodeURIComponent(getSessionId())}`);
  }

  return { getSessionId, fetchCards, fetchSpreads, postReading, fetchReadingById, fetchHistory };
})();
