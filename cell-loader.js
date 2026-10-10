'use strict';
// Hourglass loader (2026-10-11, Jonan: replaces the Orbit cell). One shared
// script for the editor and the oncOS site: it draws a monochrome hourglass in
// currentColor into every .cell-loader element. Sand drains from the upper bulb
// into the lower one, then the glass turns over. The upper sand is the bulb's
// triangle scaled about the neck; the lower sand rises with a level surface
// along the walls (2026-10-11, Jonan: no peak in the middle). Full, each is the
// other turned half a circle, so the loop has no seam. The motion
// is SVG (SMIL) animation, so it needs no stylesheet: the editor's CSP forbids
// injected styles, and the site's animation:none rule does not reach it. Under
// reduced motion each glass is paused part drained. Every shape carries its own
// fill and stroke: the editor styles every svg with fill:none, which the sand
// would otherwise inherit.
globalThis.OncosCellLoader = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cycle = 'dur="1.6s" repeatCount="indefinite"';
  const glass = '<svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
    + `<g><animateTransform attributeName="transform" type="rotate" values="0 12 12;0 12 12;180 12 12" keyTimes="0;.78;1" calcMode="spline" keySplines="0 0 1 1;.5 0 .2 1" ${cycle}/>`
    + '<path class="hg-glass" fill="none" stroke="currentColor" stroke-width="1.6" d="M6 3h12l-5.4 9 5.4 9H6l5.4-9z"/>'
    + `<g transform="translate(12 10.67)"><g><animateTransform attributeName="transform" type="scale" values="1;0;0" keyTimes="0;.78;1" ${cycle}/><path fill="currentColor" stroke="none" d="M-3.4-5.67h6.8L0 0z"/></g></g>`
    + `<path fill="none" stroke="currentColor" stroke-width=".9" d="M12 10.67V18.4"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.03;.06;.72;.76;1" ${cycle}/></path>`
    + `<path fill="currentColor" stroke="none" d="M8.6 19H15.4L15.4 19H8.6Z"><animate attributeName="d" values="M8.6 19H15.4L15.4 19H8.6Z;M8.6 19H15.4L12 13.33H12Z;M8.6 19H15.4L12 13.33H12Z" keyTimes="0;.78;1" ${cycle}/></path>`
    + '</g></svg>';
  const mark = `<span class="cell-loader" aria-hidden="true">${glass}</span>`;
  function status(message) {
    return `<span class="cell-wait" role="status">${mark}<span class="cell-wait-label">${escape(message)}</span></span>`;
  }
  function show(container, message) {
    if (!container) return;
    const label = container.querySelector('.cell-wait-label');
    if (label) label.textContent = message;
    else container.innerHTML = `<div class="empty-queue">${status(message)}</div>`;
  }
  function attach(container) {
    if (!container) return () => {};
    const node = document.createElement('span');
    node.className = 'cell-loader'; node.setAttribute('aria-hidden', 'true');
    node.innerHTML = glass; container.prepend(node);
    return () => node.remove();
  }

  // Pages also write bare <span class="cell-loader"> markup; fill each one once.
  let reduced = null;
  function discover() {
    document.querySelectorAll('.cell-loader').forEach(element => {
      if (!element.querySelector('.hg-glass')) element.innerHTML = glass;
      const svg = element.querySelector('svg');
      if (!svg || svg.pauseAnimations === undefined) return;
      const still = reduced.matches;
      if (svg.dataset.still === String(still)) return;
      svg.dataset.still = String(still);
      if (still) { svg.pauseAnimations(); svg.setCurrentTime(.6); } else svg.unpauseAnimations();
    });
  }
  function start() {
    reduced = matchMedia('(prefers-reduced-motion: reduce)');
    reduced.addEventListener('change', discover);
    discover();
    new MutationObserver(records => {
      if (records.some(r => r.addedNodes.length)) discover();
    }).observe(document.body, {childList: true, subtree: true});
  }
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
    else start();
  }
  return {status, show, attach};
})();
