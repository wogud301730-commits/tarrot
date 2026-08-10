// 배경 별 연출 (docs/05 §1) — CSS 애니메이션만 사용, 외부 이미지/캔버스 없음.
window.TarotBackground = (function () {
  function init() {
    const container = document.getElementById('bgStars');
    if (!container || container.dataset.initialized) return;
    container.dataset.initialized = 'true';

    const STAR_COUNT = 28;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const star = document.createElement('span');
      star.className = 'bg-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 70}%`;
      star.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
      star.style.animationDuration = `${(3 + Math.random() * 3).toFixed(2)}s`;
      fragment.appendChild(star);
    }

    container.appendChild(fragment);
  }

  return { init };
})();
