'use strict';
(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeAsset = (path) => typeof path === 'string' && /^\.\/assets\/[\w\-./]+$/.test(path) ? path : '';
  const fileName = (image) => image.src.split('/').pop();
  // Only the figures listed in an experience's keyFigures are bolded, so a few key numbers stand out.
  let activeFigures = [];
  let activeSeen = new Set();  // each figure is bolded once per view
  const reEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Phrases that read as one unit (세 차례, 59만 7,700원, 6개 학교, 신한 20+ 뛰어요) get no-break spaces
  // so a line never ends on the number or modifier alone.
  const glue = (text) => String(text ?? '')
    .replace(/(^|[\s(‘])(한|두|세|네|다섯|약|총|각) (?=\S)/g, '$1$2\u00a0')
    .replace(/(\d[\d,.]*만) (?=\d)/g, '$1\u00a0')
    .replace(/(\d[\d,.]*(?:개|명|곳|편|건|회|부|종|가지)) (?=팀|학교|학과|구단|시군|읍면동|주제|구간|범주|문항|안팎)/g, '$1\u00a0')
    .replace(/(신한|FC|Team-Mate) (?=20\+|엠제트|Libertz|\d+(?:~\d+)?기)/g, '$1\u00a0')
    .replace(/(\d[\d,.]*(?:종|부)) (?=\d)/g, '$1\u00a0')
    .replace(/MZ하지 않은 엠제트/g, 'MZ하지\u00a0않은\u00a0엠제트')
    .replace(/(^|[\s(])(팀|및) (?=\S)/g, '$1$2\u00a0')
    .replace(/‘[^’]{1,14}’/g, (quote) => quote.replace(/ /g, '\u00a0'))
    .replace(/그 결과/g, '그\u00a0결과')
    .replace(/([A-Za-z0-9])-(?=[A-Za-z0-9가-힣])/g, '$1-\u2060')
    .replace(/20\+ 뛰어요/g, '20+\u00a0뛰어요');
  const rich = (text, figures = activeFigures, seen = activeSeen) => {
    const html = escape(glue(text));
    if (!figures?.length) return html;
    const pattern = new RegExp(`(?<![\\d,.])(?:${[...figures].sort((a,b) => b.length-a.length).map((f) => reEscape(escape(glue(f)))).join('|')})`, 'g');
    return html.replace(pattern, (match) => seen.has(match) ? match : (seen.add(match), `<strong class="num">${match}</strong>`));
  };
  const list = (items) => `<ul>${items.map((text) => `<li>${rich(text)}</li>`).join('')}</ul>`;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposeCurrent = () => {};

  function groupsFor(item) {
    if (item.detailGroups?.length) return item.detailGroups;
    return [{id:'overview',label:'활동 내용',summary:item.background ?? '',role:item.role,sections:item.detailSections ?? [],outcomes:item.outcomes ?? [],teamOutcomes:item.teamOutcomes ?? [],imageFiles:(item.images ?? []).map(fileName),note:item.note,learning:item.hrdFocus}];
  }

  function gallery(images, key) {
    if (!images.length) return '';
    const slides = images.map((img,index) => {
      const width = Number(img.width) || 1200;
      const height = Number(img.height) || 800;
      return `<figure class="case-slide" style="--media-ratio:${width/height}" role="group" aria-roledescription="슬라이드" aria-label="${index+1} / ${images.length}"><button type="button" class="case-image-button" data-image-src="${escape(safeAsset(img.src))}" data-image-alt="${escape(img.alt)}" data-image-caption="${escape(img.caption ?? img.alt)}" data-gallery-key="${escape(key)}" data-gallery-index="${index}" aria-label="${escape(img.alt)} 크게 보기"><span class="case-image-stage"><img src="${escape(safeAsset(img.src))}" alt="${escape(img.alt)}" width="${width}" height="${height}" loading="${index===0 ? 'eager' : 'lazy'}" decoding="async" draggable="false"></span><span class="case-image-bottom"><span>${escape(glue(img.caption ?? img.alt))}</span><span class="case-image-expand" aria-hidden="true">크게 보기</span></span></button></figure>`;
    }).join('');
    return `<section class="case-gallery" data-carousel role="region" aria-roledescription="캐러셀" aria-label="사진과 자료"><div class="case-gallery-toolbar"><h4>사진·자료</h4><div class="case-gallery-controls"><span class="case-gallery-count" data-carousel-count aria-live="polite">1 / ${images.length}</span><button type="button" class="case-arrow" data-carousel-prev aria-label="이전 사진" disabled ${images.length<2 ? 'hidden' : ''}>←</button><button type="button" class="case-arrow" data-carousel-next aria-label="다음 사진" ${images.length<2 ? 'hidden' : ''}>→</button></div></div><div class="case-gallery-track${images.length===1 ? ' is-single' : ''}" data-carousel-track tabindex="0" aria-label="사진 목록. 좌우 방향키로 넘길 수 있습니다.">${slides}</div></section>`;
  }

  // Role and results come first so a reader gets the outcome before the process.
  function overview(group, role) {
    const rows = [
      role ? ['내가 맡은 일', `<p>${rich(role)}</p>`] : null,
      group.outcomes?.length ? ['결과', list(group.outcomes)] : null,
      group.teamOutcomes?.length ? ['팀 결과', list(group.teamOutcomes)] : null
    ].filter(Boolean);
    return rows.length ? `<dl class="case-overview">${rows.map(([label,contents]) => `<div><dt>${label}</dt><dd>${contents}</dd></div>`).join('')}</dl>` : '';
  }


  function facts(rows,extraClass = '') {
    const values = rows.filter(([,value]) => value);
    return values.length ? `<dl class="case-facts ${extraClass}">${values.map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(glue(value))}</dd></div>`).join('')}</dl>` : '';
  }

  function groupContent(item, group, multiple) {
    activeFigures = item.keyFigures ?? [];
    const images = (item.images ?? []).filter((img) => safeAsset(img.src));
    const byName = new Map(images.map((img) => [fileName(img),img]));
    const selected = [...new Set(group.imageFiles ?? [])].map((name) => byName.get(name)).filter(Boolean);
    const role = group.role ?? item.role;
    // The tab heading already names the contest, so only the date and award are repeated here.
    const projectFacts = facts([['시기',group.period],['수상',group.award]],'case-project-facts');
    const intro = `<div class="case-group-intro">${multiple ? `<h3>${escape(glue(group.label))}</h3>` : ''}${projectFacts}${overview(group,role)}</div>`;
    const context = group.summary ? `<section class="case-context"><h4>활동 배경</h4><p>${rich(group.summary)}</p></section>` : '';
    const process = (group.sections ?? []).filter((part) => part.items?.length || part.subsections?.some(sub=>sub.items?.length)).map((part,index) => {
      const contents = part.subsections?.length ? part.subsections.map((sub) => `<section class="case-work-subsection"><h5>${escape(sub.title)}</h5>${list(sub.items)}</section>`).join('') : list(part.items);
      return part.subsections?.length ? `<details class="case-work"${index===0 ? ' open' : ''}><summary><h4>${escape(part.title)}</h4><span class="case-work-toggle" aria-hidden="true">＋</span></summary><div class="case-step-content">${contents}</div></details>` : `<section class="case-step"><div class="case-step-heading"><h4>${escape(part.title)}</h4></div><div class="case-step-content">${contents}</div></section>`;
    }).join('');
    return intro + context + `<div class="case-flow">${process}</div>` + gallery(selected,`${item.id}-${group.id}`) + (group.note ? `<aside class="case-note">${escape(group.note)}</aside>` : '');
  }

  // Reflections (hrdFocus, group.learning) stay in content.js but are not rendered; the detail ends with photos.
  function render(item, typeLabel) {
    activeFigures = item.keyFigures ?? [];
    activeSeen = new Set();
    const groups = groupsFor(item);
    const collection = item.detailCollection;
    const meta = collection ? '' : facts([['기간',item.period],[item.type === 'competition' ? '대회' : '소속',item.organization],['참여',item.format],['수상',item.award]]);
    const header = `<p class="detail-eyebrow">${escape(collection ? typeLabel : item.hrdLabel ?? typeLabel)}</p><h2 id="detailTitle">${escape(glue(collection?.title ?? item.title))}</h2><p class="case-summary">${rich(collection?.summary ?? item.detailSummary ?? item.takeaway ?? item.summary)}</p>${meta}`;
    const shortLabels = {'team-mate':'Team-Mate',camp:'취업캠프',education:'교육운영'};
    const tabs = groups.length > 1 ? `<div class="case-tabs" role="tablist" aria-label="${escape(collection?.tabLabel ?? '담당 활동')}">${groups.map((group,index) => `<button type="button" id="case-tab-${index}" class="case-tab" data-case-tab="${index}" role="tab" aria-selected="${index === 0}" aria-controls="case-panel" tabindex="${index === 0 ? 0 : -1}">${escape(glue(group.tabLabel ?? shortLabels[group.id] ?? group.label))}</button>`).join('')}</div>` : '';
    const body = `<div class="case-body" data-case-body>${tabs}<div id="case-panel" class="case-panel" ${groups.length > 1 ? 'role="tabpanel" aria-labelledby="case-tab-0" tabindex="0"' : ''}>${groupContent(item,groups[0],groups.length > 1)}</div></div>`;
    return {header,body};
  }

  function mount(root,item) {
    disposeCurrent();
    const controller = new AbortController();
    const options = {signal:controller.signal};
    let galleryDisposers = [];
    const clearGalleries = () => { galleryDisposers.forEach((dispose) => dispose()); galleryDisposers = []; };
    const groups = groupsFor(item);
    const panel = root.querySelector('#case-panel');
    let activeTab = 0;

    function initGallery(carousel) {
      const track = carousel.querySelector('[data-carousel-track]');
      const slides = [...track.querySelectorAll('.case-slide')];
      const prev = carousel.querySelector('[data-carousel-prev]');
      const next = carousel.querySelector('[data-carousel-next]');
      const count = carousel.querySelector('[data-carousel-count]');
      const local = new AbortController();
      const on = {signal:local.signal};
      let active = 0;
      let settleTimer;
      let start = null;
      let dragged = false;
      let suppressClickUntil = 0;
      let offsets = [];
      let measureFrame = 0;
      let measuredWidth = -1;
      let maxLeft = 0;
      let dragFrame = 0;
      let dragLeft = 0;
      const clamp = (left) => Math.max(0,Math.min(maxLeft,left));
      const nearest = (left) => offsets.reduce((best,offset,index) => Math.abs(offset-left)<Math.abs(offsets[best]-left) ? index : best,0);
      const controls = () => {
        const label = `${active+1} / ${slides.length}`;
        if (count.textContent !== label) count.textContent = label;
        if (prev.disabled !== (active === 0)) prev.disabled = active === 0;
        if (next.disabled !== (active === slides.length-1)) next.disabled = active === slides.length-1;
      };
      const update = () => {
        if (!offsets.length) return;
        const left = track.scrollLeft;
        active = nearest(left);
        controls();
      };
      const measure = () => {
        cancelAnimationFrame(measureFrame);
        measureFrame = 0;
        const first = slides[0]?.offsetLeft ?? 0;
        maxLeft = Math.max(0,track.scrollWidth-track.clientWidth);
        offsets = slides.map((slide) => Math.min(maxLeft,slide.offsetLeft-first));
        update();
      };
      const scheduleMeasure = () => { if (!measureFrame) measureFrame = requestAnimationFrame(measure); };
      const settle = () => {
        if (start) return;
        track.classList.remove('is-gliding');
        update();
      };
      const go = (index) => {
        if (!offsets.length) measure();
        const target = Math.max(0,Math.min(slides.length-1,index));
        active = target;
        controls();
        const left = offsets[target];
        track.classList.add('is-gliding');
        track.scrollTo({left,behavior:reducedMotion() ? 'instant' : 'smooth'});
        clearTimeout(settleTimer);
        settleTimer = setTimeout(settle,150);
        return target;
      };
      prev.addEventListener('click',() => go(active-1),on);
      next.addEventListener('click',() => go(active+1),on);
      track.addEventListener('scroll',() => { clearTimeout(settleTimer); settleTimer = setTimeout(settle,150); },{...on,passive:true});
      track.addEventListener('scrollend',settle,on);
      track.addEventListener('keydown',(event) => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const target = go(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length-1 : active + (event.key === 'ArrowRight' ? 1 : -1));
        if (event.target.closest('.case-image-button')) slides[target].querySelector('.case-image-button').focus({preventScroll:true});
      },on);
      track.addEventListener('pointerdown',(event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        if (!offsets.length) measure();
        clearTimeout(settleTimer);
        const left = track.scrollLeft;
        track.scrollTo({left,behavior:'instant'});
        start = {x:event.clientX,y:event.clientY,left,id:event.pointerId,lastX:event.clientX,lastTime:performance.now(),velocity:0};
        dragged = false;
      },on);
      track.addEventListener('pointermove',(event) => {
        if (!start || event.pointerId !== start.id) return;
        const delta = event.clientX-start.x;
        if (!dragged && Math.abs(delta)>7 && Math.abs(delta)>Math.abs(event.clientY-start.y)) {
          dragged = true;
          track.classList.add('is-dragging');
          track.setPointerCapture(event.pointerId);
        }
        if (dragged) {
          event.preventDefault();
          const now = performance.now();
          const elapsed = now-start.lastTime;
          if (elapsed>0) start.velocity = .4*start.velocity+.6*(start.lastX-event.clientX)/elapsed;
          start.lastX = event.clientX;
          start.lastTime = now;
          dragLeft = clamp(start.left-delta);
          if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame=0; track.scrollLeft=dragLeft; });
        }
      },on);
      const finish = (event) => {
        if (!start || event.pointerId !== start.id) return;
        const wasDragged = dragged;
        const pointerId = start.id;
        const velocity = event.type!=='pointerup' || performance.now()-start.lastTime>100 ? 0 : Math.max(-2,Math.min(2,start.velocity));
        cancelAnimationFrame(dragFrame);
        dragFrame = 0;
        if (wasDragged) track.scrollLeft = dragLeft;
        start = null;
        if (wasDragged) {
          suppressClickUntil = performance.now()+350;
          // Keep snapping disabled until the browser's one smooth glide has settled.
          go(nearest(clamp(dragLeft+velocity*140)));
        } else settle();
        track.classList.remove('is-dragging');
        if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
      };
      track.addEventListener('pointerup',finish,on);
      track.addEventListener('pointercancel',finish,on);
      track.addEventListener('lostpointercapture',finish,on);
      track.addEventListener('pointerleave',() => { if (!dragged) { start = null; settle(); } },on);
      track.addEventListener('click',(event) => {
        if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
      },{...on,capture:true});
      // Measure after the first layout, once per width change; scrolling uses cached offsets.
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width === measuredWidth) return;
        measuredWidth = entry.contentRect.width;
        scheduleMeasure();
      });
      observer.observe(track);
      window.addEventListener('resize',scheduleMeasure,on);
      controls();
      galleryDisposers.push(() => { clearTimeout(settleTimer); cancelAnimationFrame(measureFrame); cancelAnimationFrame(dragFrame); observer.disconnect(); local.abort(); });
    }

    function activate(index,focus) {
      if (index === activeTab) {
        if (focus) root.querySelector(`[data-case-tab="${index}"]`).focus({preventScroll:true});
        return;
      }
      // Read the stable tab position before replacing its panel contents.
      const caseBody = root.querySelector('[data-case-body]');
      const toolbarHeight = root.querySelector('.sheet-topline').offsetHeight;
      const top = root.scrollTop+caseBody.getBoundingClientRect().top-root.getBoundingClientRect().top-toolbarHeight-8;
      activeTab = index;
      clearGalleries();
      root.querySelectorAll('[data-case-tab]').forEach((tab,i) => {
        tab.setAttribute('aria-selected',String(i===index));
        tab.tabIndex = i===index ? 0 : -1;
        if (focus && i===index) tab.focus({preventScroll:true});
      });
      panel.setAttribute('aria-labelledby',`case-tab-${index}`);
      activeSeen = new Set();
      panel.innerHTML = groupContent(item,groups[index],true);
      panel.querySelectorAll('[data-carousel]').forEach(initGallery);
      root.scrollTo({top:Math.max(0,top),behavior:'instant'});
    }
    root.addEventListener('click',(event) => {
      const tab = event.target.closest('[data-case-tab]');
      if (tab) activate(Number(tab.dataset.caseTab),false);
    },options);
    root.addEventListener('keydown',(event) => {
      if (!event.target.closest('[data-case-tab]') || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? groups.length-1 : (activeTab+(event.key==='ArrowRight' ? 1 : groups.length-1))%groups.length;
      activate(index,true);
    },options);
    panel.querySelectorAll('[data-carousel]').forEach(initGallery);
    disposeCurrent = () => { controller.abort(); clearGalleries(); };
  }

  window.PortfolioDetails = {render,mount,rich,glue,clear:() => {disposeCurrent(); disposeCurrent=() => {};}};
})();
