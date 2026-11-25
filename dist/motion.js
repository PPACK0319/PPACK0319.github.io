'use strict';
// Page motion: headline reveal, fade-up on scroll, cycling competency pills, stacked competency cards,
// number count-up, scroll progress and the active menu item. Nothing here moves under reduced motion.
(() => {
  const root = document.documentElement;
  const $ = (selector) => document.querySelector(selector);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduce && 'IntersectionObserver' in window;
  const header = $('#siteHeader');
  const bar = $('#scrollProgress');
  const stackQuery = matchMedia('(min-width: 961px) and (min-height: 721px)');
  root.classList.toggle('motion-ok', motion);

  const format = (value) => Math.round(value).toLocaleString('ko-KR');
  function countUp(scope) {
    for (const node of scope.querySelectorAll('[data-count]:not([data-counted])')) {
      node.dataset.counted = '';
      const target = Number(node.dataset.count);
      if (!motion || !Number.isFinite(target) || target <= 0) { node.textContent = format(target); continue; }
      const duration = 1500;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        node.textContent = format(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(tick);
      };
      node.textContent = '0';
      requestAnimationFrame(tick);
    }
  }

  // Elements entering together get a short stagger; once shown they drop the reveal styles entirely.
  let revealer = null;
  const settle = (node) => {
    node.addEventListener('transitionend', function done(event) {
      if (event.target !== node || event.propertyName !== 'opacity') return;
      node.removeEventListener('transitionend', done);
      node.removeAttribute('data-reveal');
      node.classList.remove('is-in');
      node.style.removeProperty('--delay');
    });
  };
  function observe() {
    for (const row of document.querySelectorAll('.award-row, .career-row')) if (!row.dataset.revealed) { row.dataset.revealed = ''; row.setAttribute('data-reveal', ''); }
    const targets = document.querySelectorAll('[data-reveal]:not(.is-in), .comp-card:not(.is-in)');
    if (!motion) { for (const node of targets) { node.classList.add('is-in'); countUp(node); } return; }
    revealer ??= new IntersectionObserver((entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      entering.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      entering.forEach((node, index) => {
        revealer.unobserve(node);
        if (node.hasAttribute('data-reveal')) { node.style.setProperty('--delay', `${Math.min(index * 0.08, 0.48)}s`); settle(node); }
        node.classList.add('is-in');
        countUp(node);
      });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.12});
    for (const node of targets) revealer.observe(node);
  }

  // Hero pills light up one after another while the hero is on screen.
  function cyclePills() {
    const pills = [...document.querySelectorAll('#heroSkills li')];
    if (!motion || pills.length < 2) return;
    let index = -1, timer = null, paused = false;
    const step = () => { if (paused) return; pills.forEach((pill) => pill.classList.remove('is-active')); index = (index + 1) % pills.length; pills[index].classList.add('is-active'); };
    const list = $('#heroSkills');
    list.addEventListener('pointerenter', () => { paused = true; pills.forEach((pill) => pill.classList.remove('is-active')); });
    list.addEventListener('pointerleave', () => { paused = false; });
    list.addEventListener('focusin', () => { paused = true; pills.forEach((pill) => pill.classList.remove('is-active')); });
    list.addEventListener('focusout', () => { paused = false; });
    new IntersectionObserver(([entry]) => {
      clearInterval(timer); timer = null;
      if (entry.isIntersecting) { setTimeout(step, 900); timer = setInterval(step, 1700); }
    }).observe($('#top'));
  }

  // Each stuck competency card shrinks and dims while the next one slides over it.
  // The scroll span for that is measured once per layout; browsers with scroll-linked animation then run it
  // in step with the scroll itself, others follow scrollY on each frame.
  const stackBox = $('#competencyStack');
  const cards = () => [...document.querySelectorAll('.comp-card')];
  const linked = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()');
  let spans = [];
  function measure() {
    const list = cards();
    const active = motion && stackQuery.matches && list.length > 1;
    stackBox?.classList.toggle('is-timed', active && linked);
    spans = [];
    if (!active) { for (const card of list) card.style.setProperty('--covered', '0'); return; }
    // Natural (unstuck) top of each card: the stack's top plus the cards and gaps above it.
    let natural = stackBox.getBoundingClientRect().top + scrollY;
    list.forEach((card, index) => {
      const style = getComputedStyle(card);
      const height = card.offsetHeight;
      const gap = parseFloat(style.marginBottom) || 0;
      const stuck = parseFloat(style.top) || 0;
      const next = list[index + 1];
      if (next) {
        // Starts when the next card's top reaches this card's bottom, ends when the next card sticks.
        const start = natural + gap - stuck;
        const end = Math.max(start + 1, natural + height + gap - (parseFloat(getComputedStyle(next).top) || stuck));
        spans.push([start, end]);
        card.style.setProperty('--cover-start', `${Math.round(start)}px`);
        card.style.setProperty('--cover-end', `${Math.round(end)}px`);
      }
      natural += height + gap;
    });
  }
  function stack() {
    if (!spans.length || linked) return;
    cards().forEach((card, index) => {
      const span = spans[index];
      const covered = span ? Math.min(1, Math.max(0, (scrollY - span[0]) / (span[1] - span[0]))) : 0;
      card.style.setProperty('--covered', covered.toFixed(3));
    });
  }
  if (stackBox && 'ResizeObserver' in window) new ResizeObserver(() => { measure(); stack(); }).observe(stackBox);
  stackQuery.addEventListener?.('change', () => { measure(); stack(); });
  document.fonts?.ready.then(() => { measure(); stack(); });

  let queued = false;
  function frame() {
    queued = false;
    const max = root.scrollHeight - innerHeight;
    bar?.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : '0');
    header?.classList.toggle('is-scrolled', scrollY > 8);
    stack();
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', queue, {passive: true});
  addEventListener('resize', () => { measure(); queue(); });

  function activeNav() {
    const links = [...document.querySelectorAll('[data-nav]')];
    const sections = links.map((link) => document.getElementById(link.dataset.nav)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;
    const visible = new Set();
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id);
      const current = sections.find((section) => visible.has(section.id))?.id;
      for (const link of links) {
        const on = link.dataset.nav === current;
        link.classList.toggle('is-active', on);
        on ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current');
      }
    }, {rootMargin: '-40% 0px -55% 0px'});
    for (const section of sections) watcher.observe(section);
  }

  function marquee() {
    const track = $('#marqueeTrack');
    const half = track?.firstElementChild;
    if (!half) return;
    // A steady reading speed whatever the band's length.
    track.style.setProperty('--marquee-duration', `${Math.max(24, half.scrollWidth / 55).toFixed(1)}s`);
  }

  function start() {
    observe();
    cyclePills();
    activeNav();
    marquee();
    measure();
    frame();
    addEventListener('load', () => { measure(); stack(); });
    if (motion) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
  }
  window.PortfolioMotion = {observe};
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
