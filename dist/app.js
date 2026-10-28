'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const grid = $('#experienceGrid');
  const dialog = $('#detailDialog');
  const actionDialog = $('#actionsDialog');
  const imageDialog = $('#imageDialog');
  const header = $('#detailHeader');
  const body = $('#detailBody');
  const toast = $('#toast');
  const content = window.PORTFOLIO_CONTENT ?? {experiences:[],awards:[],journey:[],certifications:[]};
  const labels = { hrd: '대표 경험', competition: '공모전·수상', activity: '대외활동', work: '실무·프로젝트' };
  let currentId = null;
  let toastTimer;
  let viewerImages = [];
  let viewerIndex = 0;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safeAsset = (path) => typeof path === 'string' && /^\.\/assets\/[\w\-./]+$/.test(path) ? path : '';
  const imagesFor = (item) => (item.images ?? []).filter((img) => safeAsset(img.src));
  const paragraph = (text) => `<p>${escape(text)}</p>`;
  const list = (items) => `<ul>${items.map((text) => `<li>${escape(text)}</li>`).join('')}</ul>`;
  const section = (title, contents) => contents ? `<section class="detail-section"><h3>${escape(title)}</h3>${contents}</section>` : '';
  const careerPeriod = (row) => {
    const [date, ...meta] = row.period.split(' · ');
    return `<span class="career-date">${escape(date)}</span>${row.periodNote || meta.length ? `<span class="career-meta">${escape(row.periodNote ?? meta.join(' · '))}</span>` : ''}`;
  };
  function announce(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }
  // Representative cards stay selected; awarded collection members also open from their award rows.
  const isFeatured = (id) => content.experiences.some((item) => item.id === id && item.hrd) || content.experiences.some((item) => item.detailCollection?.experienceIds?.includes(id));
  function renderCards() {
    const items = content.experiences.filter((item) => item.hrd);
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = items.map((item) => {
      const first = imagesFor(item)[0];
      const media = first ? `<div class="card-media${first.kind === 'photo' ? ' is-photo' : ''}${Number(first.height) > Number(first.width) * 1.2 ? ' is-portrait' : ''}"><img src="${escape(safeAsset(first.src))}" alt="${escape(first.alt)}" width="${Number(first.width) || 1200}" height="${Number(first.height) || 800}" loading="lazy" decoding="async"></div>` : '';
      return `<button type="button" class="experience-card${first ? '' : ' is-text'}" data-experience="${escape(item.id)}" aria-label="${escape(item.title)} 자세히 보기">${media}<div class="card-content"><span class="category-label">${escape(window.PortfolioDetails.glue(item.hrdLabel ?? labels[item.type]))}</span><h3>${escape(window.PortfolioDetails.glue(item.title))}</h3><p class="card-summary">${window.PortfolioDetails.rich(item.takeaway ?? item.summary, item.keyFigures, new Set())}</p><span class="card-period">${escape(item.period)}</span></div></button>`;
    }).join('');
  }
  function renderAwards() {
    $('#awardList').innerHTML = content.awards.map((award) => {
      const linked = award.experienceId && isFeatured(award.experienceId);
      // An award that is one tab of a bundled detail opens that bundle on its own tab.
      const bundle = linked ? content.experiences.find((item) => item.id !== award.experienceId && item.detailCollection?.experienceIds?.includes(award.experienceId)) : null;
      const groupIndex = award.groupId ? content.experiences.find((item) => item.id === award.experienceId)?.detailGroups?.findIndex((group) => group.id === award.groupId) ?? -1 : -1;
      const target = bundle ? `data-experience="${escape(bundle.id)}" data-tab="${bundle.detailCollection.experienceIds.indexOf(award.experienceId)}"` : `data-experience="${escape(award.experienceId)}"${groupIndex > 0 ? ` data-tab="${groupIndex}"` : ''}`;
      return `<${linked ? `button type="button" ${target}` : 'div'} class="award-row"><span class="award-date">${escape(award.date)}</span><span class="award-title">${escape(window.PortfolioDetails.glue(award.title))}</span><span class="award-badge">${escape(award.award)}</span></${linked ? 'button' : 'div'}>`;
    }).join('');
    $('#careerList').innerHTML = content.journey.map((row) => {
      const linked = row.experienceId && isFeatured(row.experienceId);
      return `<${linked ? `button type="button" data-experience="${escape(row.experienceId)}"` : 'div'} class="career-row"><span class="career-period">${careerPeriod(row)}</span><div class="career-content"><h3>${escape(window.PortfolioDetails.glue(row.title))}</h3><p>${escape(window.PortfolioDetails.glue(row.role))}</p></div></${linked ? 'button' : 'div'}>`;
    }).join('');
  }
  function showDialog(target) {
    if (!target.open) target.showModal();
    target.scrollTop = 0;
  }
  function openExperience(id, fromHash = false) {
    const item = content.experiences.find((candidate) => candidate.id === id);
    if (!item) { if (fromHash) announce('해당 경험을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.', true); return; }
    // History traversal can emit both popstate and hashchange for the same route.
    if (dialog.open && currentId === id) return;
    closeDialog(imageDialog);
    currentId = item.id;
    const rendered = window.PortfolioDetails.render(item,labels[item.type]);
    header.innerHTML = rendered.header;
    body.innerHTML = rendered.body;
    dialog.classList.add('experience-detail');
    $('#copyDetail').hidden = false;
    showDialog(dialog);
    window.PortfolioDetails.mount(dialog,item);
    if (!fromHash && location.hash !== `#experience/${encodeURIComponent(id)}`) history.pushState({experience:id}, '', `#experience/${encodeURIComponent(id)}`);
  }
  function openProfile() {
    closeDialog(imageDialog);
    window.PortfolioDetails.clear();
    dialog.classList.remove('experience-detail');
    currentId = null;
    header.innerHTML = '<p class="detail-eyebrow">프로필</p><h2 id="detailTitle">박중훈 <span class="profile-english">Park JungHun</span></h2><div class="detail-takeaway"><span>한 줄 소개</span><p>소통은 유연하게, AI는 능숙하게.</p></div><p class="detail-summary">' + escape([...document.querySelectorAll('.profile-info > div')].map((row) => `${row.querySelector('dt').textContent} ${row.querySelector('dd').textContent}`).join(' · ')) + '</p>';
    body.innerHTML = section('학업', paragraph(content.profile?.education ?? '건국대학교 지리학과 / 기술경영학과 복수전공')) + section('학점', content.profile?.gpa ? paragraph(`${content.profile.gpa} · ${content.profile.gpaNote ?? ''}`) : '') + section('자격증', content.certifications?.length ? list(content.certifications.map((cert) => `${cert.name} · ${cert.date}`)) : '') + section('주요 이력', content.journey.map((row) => `<div class="profile-history"><strong>${escape(row.title)}</strong><p>${escape(row.period)}${row.periodNote ? ' · '+escape(row.periodNote) : ''} · ${escape(row.role)}</p></div>`).join('')) + section('학업·활동 수상', content.awards.some((award) => award.profile) ? list(content.awards.filter((award) => award.profile).map((award) => `${award.title} · ${award.award} · ${award.date}`)) : '') + section('다루는 도구', '<p>Excel · PowerPoint · 한글(HWP) · Word · ArcGIS · QGIS · AI(ChatGPT Codex, Claude Code)</p>');
    $('#copyDetail').hidden = true;
    showDialog(dialog);
  }
  function clearDetailHash() {
    if (location.hash.startsWith('#experience/')) history.replaceState(null, '', `${location.pathname}${location.search}#experiences`);
  }
  function closeDialog(target) { if (target === dialog && imageDialog.open) imageDialog.close(); if (target.open) target.close(); }
  function showViewerImage(index) {
    viewerIndex = index;
    const image = viewerImages[index];
    const src = safeAsset(image.src);
    if (!src) return;
    $('#viewerImage').src = src;
    $('#viewerImage').alt = image.alt;
    $('#viewerCaption').textContent = image.caption;
    $('#imageTitle').textContent = '자료 크게 보기';
    $('.image-stage').classList.remove('is-zoomed');
    $('#toggleImageZoom').setAttribute('aria-pressed','false');
    $('#toggleImageZoom').textContent = '원본 크기';
    $('#viewerSequence').hidden = viewerImages.length < 2;
    $('#viewerPosition').textContent = `${viewerIndex+1} / ${viewerImages.length}`;
    $('#viewerPrevious').disabled = viewerIndex === 0;
    $('#viewerNext').disabled = viewerIndex === viewerImages.length-1;
    $('.image-stage').scrollTop = 0;
    $('.image-stage').scrollLeft = 0;
  }
  function openImage(button) {
    const key = button.dataset.galleryKey;
    const buttons = key ? [...dialog.querySelectorAll('[data-gallery-key]')].filter((candidate) => candidate.dataset.galleryKey === key) : [button];
    viewerImages = buttons.map((candidate) => ({src:candidate.dataset.imageSrc,alt:candidate.dataset.imageAlt ?? '',caption:candidate.dataset.imageCaption ?? ''}));
    showViewerImage(Math.max(0,buttons.indexOf(button)));
    showDialog(imageDialog);
  }
  $('#viewerPrevious').addEventListener('click',() => { if (viewerIndex>0) showViewerImage(viewerIndex-1); });
  $('#viewerNext').addEventListener('click',() => { if (viewerIndex<viewerImages.length-1) showViewerImage(viewerIndex+1); });
  imageDialog.addEventListener('keydown',(event) => {
    if ($('.image-stage').classList.contains('is-zoomed') || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    showViewerImage(Math.max(0,Math.min(viewerImages.length-1,viewerIndex+(event.key==='ArrowRight' ? 1 : -1))));
  });
  $('#toggleImageZoom').addEventListener('click', () => {
    const zoomed = $('.image-stage').classList.toggle('is-zoomed');
    $('#toggleImageZoom').setAttribute('aria-pressed',String(zoomed));
    $('#toggleImageZoom').textContent = zoomed ? '화면에 맞춤' : '원본 크기';
  });
  $('#closeImage').addEventListener('click', () => closeDialog(imageDialog));
  imageDialog.addEventListener('click', (event) => { if (event.target !== imageDialog) return; const rect = imageDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(imageDialog); });
  for (const target of [dialog, actionDialog]) {
    target.addEventListener('click', (event) => { if (event.target !== target) return; const rect = target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(target); });
    target.addEventListener('close', () => {
      // Native close events are queued; a reopened dialog owns its new content.
      if (target.open) return;
      if (target === dialog) { window.PortfolioDetails.clear(); clearDetailHash(); }
      // Native dialogs restore focus, including the image viewer's parent sheet.
    });
  }
  async function copyLink(detail = false) {
    const url = new URL(location.href); url.hash = detail && currentId ? `experience/${encodeURIComponent(currentId)}` : '';
    try { await navigator.clipboard.writeText(url.href); announce(detail ? '이 경험의 링크를 복사했습니다.' : '포트폴리오 링크를 복사했습니다.'); }
    catch { announce('링크를 복사하지 못했습니다. 주소창의 주소를 직접 복사해 주세요.', true); }
  }
  function printSummary() { closeDialog(imageDialog); closeDialog(actionDialog); closeDialog(dialog); requestAnimationFrame(() => window.print()); }
  document.addEventListener('click', (event) => { const image = event.target.closest('[data-image-src]'); if (image) { openImage(image); return; } const profile = event.target.closest('[data-profile]'); if (profile) { openProfile(); return; } const card = event.target.closest('[data-experience]'); if (!card) return; openExperience(card.dataset.experience); if (card.dataset.tab) dialog.querySelector(`[data-case-tab="${card.dataset.tab}"]`)?.click(); });
  $('#closeDetail').addEventListener('click', () => closeDialog(dialog));
  $('#backToList').addEventListener('click', () => closeDialog(dialog));
  $('#copyDetail').addEventListener('click', () => copyLink(true));
  $('#profileOverview').addEventListener('click', openProfile);
  $('#quickActions').addEventListener('click', () => showDialog(actionDialog));
  $('#closeActions').addEventListener('click', () => closeDialog(actionDialog));
  $('#sharePortfolio').addEventListener('click', () => { closeDialog(actionDialog); copyLink(); });
    for (const selector of ['#printResume', '#printJourney', '#printPortfolio']) $(selector).addEventListener('click', printSummary);
  $('#goTop').addEventListener('click', () => { closeDialog(actionDialog); $('#profile').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); });
  function syncHash() { if (location.hash.startsWith('#experience/')) { let id; try { id = decodeURIComponent(location.hash.slice(12)); } catch { return; } openExperience(id, true); } else if (dialog.open && currentId) closeDialog(dialog); }
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('popstate', syncHash);
  if (!content?.experiences?.length) { grid.setAttribute('aria-busy','false'); grid.innerHTML = '<p class="empty-state">경험 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>'; announce('경험 정보를 불러오지 못했습니다.', true); return; }
  if ($('#profileGpa') && content.profile?.gpa) $('#profileGpa').textContent = content.profile.gpa;
  if ($('#profileCertifications') && content.certifications?.length) $('#profileCertifications').innerHTML = content.certifications.map((cert) => `<li>${escape(cert.name.replace('정보기술자격 ITQ','ITQ'))}</li>`).join('');
  renderCards(); renderAwards(); syncHash();
})();
