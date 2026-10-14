(() => { try {
  const box = document.getElementById('pg-about');
  if (!box || !document.body || typeof getComputedStyle !== 'function') return;
  const st = el => getComputedStyle(el);
  const locked = [document.documentElement, document.body].some(el => /hidden/.test(st(el).overflow + ' ' + st(el).overflowY));
  const scrolls = document.documentElement.scrollHeight > innerHeight + 8;
  if (!locked && scrolls) {
    box.classList.add('inline');
    box.hidden = false;
    return;
  }
  box.classList.add('panel');
  const inner = document.createElement('div');
  inner.className = 'pg-in';
  while (box.firstChild) inner.appendChild(box.firstChild);
  const x = document.createElement('button');
  x.className = 'pg-x';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '×';
  inner.prepend(x);
  box.appendChild(inner);

  const back = document.querySelector('a.back');
  const link = document.createElement('button');
  link.className = 'pg-about-link';
  link.textContent = 'about';
  if (back) {
    const r = back.getBoundingClientRect();
    link.style.left = Math.round(r.right + 14) + 'px';
    link.style.top = Math.round(r.top) + 'px';
    link.style.color = st(back).color;
  } else link.style.left = '14px';
  document.body.appendChild(link);

  const open = v => { box.hidden = !v; };
  link.addEventListener('click', () => open(box.hidden));
  x.addEventListener('click', () => open(false));
  box.addEventListener('click', e => { if (e.target === box) open(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { open(false); e.stopPropagation(); } }, true);
} catch (e) { } })();
