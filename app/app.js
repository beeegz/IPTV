'use strict';
/* Chud IPTV Web — lecteur IPTV : M3U, catégories, recherche, favoris, lecteur HLS */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Stockage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('chud.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('chud.' + k, JSON.stringify(v)); return true; } catch { return false; } }
};

/* ---------- Données de démo (flux de test publics) ---------- */
const DEMO_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="n1" group-title="Généralistes",Nova 1
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Généralistes",Nova 2
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 group-title="Sport",Atlas Sport
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8
#EXTINF:-1 group-title="Sport",Stade+
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Information",Info 24
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8
#EXTINF:-1 group-title="Information",Le Monde Direct
https://test-streams.mux.dev/test_001/stream.m3u8
#EXTINF:-1 group-title="Cinéma",Ciné Club
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Cinéma",Horizon
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 group-title="Jeunesse",Petit Phare
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8
#EXTINF:-1 group-title="Découverte",Terra
https://test-streams.mux.dev/test_001/stream.m3u8
#EXTINF:-1 group-title="Musique",Écho FM TV
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Films | Action",Le Dernier Phare
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8
#EXTINF:-1 group-title="Films | Drame",Minuit à Lisbonne
https://test-streams.mux.dev/test_001/stream.m3u8
#EXTINF:-1 group-title="Films | Drame",Sel et Lumière
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="Séries | Thriller",Station Polaris
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8
#EXTINF:-1 group-title="Séries | Thriller",Les Cartographes
https://test-streams.mux.dev/test_001/stream.m3u8
`;

/* ---------- Parseur M3U ---------- */
function parseM3U(text) {
  const out = []; let cur = null; let id = 0;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = {};
      line.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => (attrs[k.toLowerCase()] = v));
      const name = line.slice(line.lastIndexOf(',') + 1).trim() || attrs['tvg-name'] || 'Sans nom';
      cur = { name, logo: attrs['tvg-logo'] || '', group: (attrs['group-title'] || 'Divers').trim() || 'Divers' };
    } else if (line.startsWith('#EXTGRP:') && cur) {
      cur.group = line.slice(8).trim() || cur.group;
    } else if (!line.startsWith('#') && /^(https?|rtmp|rtsp):\/\//i.test(line)) {
      if (!cur) cur = { name: line.split('/').pop() || 'Flux', logo: '', group: 'Divers' };
      cur.url = line; cur.id = 'c' + (id++) + '_' + hash(cur.name + line);
      cur.kind = kindOf(cur);
      out.push(cur); cur = null;
    }
  }
  return out;
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function kindOf(c) {
  const g = norm(c.group), u = c.url.toLowerCase();
  if (/\/series\//.test(u) || /\bs[eé]ries?\b/.test(g)) return 'series';
  if (/\/movie\//.test(u) || /(^|[^a-z])(films?|movies?|vod)([^a-z]|$)/.test(g)) return 'movies';
  return 'live';
}
/* "Films | Action" -> catégorie "Action" */
const catOf = c => c.group.includes('|') ? c.group.split('|').slice(1).join('|').trim() || c.group : c.group;

/* ---------- État ---------- */
const state = {
  channels: store.get('channels', []),
  favs: new Set(store.get('favs', [])),
  view: 'home', cat: 'all', query: '', limit: 60,
  current: null, queue: []
};
const saveFavs = () => store.set('favs', [...state.favs]);

/* ---------- Couleurs / vignettes ---------- */
const palette = [['#3b82f6'], ['#6366f1'], ['#0ea5e9'], ['#22c55e'], ['#16a34a'], ['#ef4444'], ['#f97316'], ['#a855f7'], ['#14b8a6'], ['#e11d48'], ['#ca8a04'], ['#7c3aed']];
const colorOf = c => palette[parseInt(hash(c.name), 36) % palette.length][0];
const initials = n => { const w = n.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/); return ((w[0]?.[0] || '?') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase(); };
function thumb(c, poster) {
  const t = el('div', 'thumb' + (poster ? ' poster' : '')); t.style.setProperty('--c1', colorOf(c));
  const ini = el('span', 'ini', esc(initials(c.name))); t.append(ini);
  if (c.logo) {
    const img = new Image(); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.alt = '';
    img.onload = () => ini.remove(); img.onerror = () => img.remove(); img.src = c.logo; t.append(img);
  }
  if (c.kind === 'live') t.append(el('span', 'live', 'DIRECT'));
  return t;
}
function card(c) {
  const b = el('div', 'card'); b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', c.name);
  b.append(thumb(c, c.kind !== 'live'));
  const f = el('button', 'fav' + (state.favs.has(c.id) ? ' on' : ''), state.favs.has(c.id) ? '★' : '☆');
  f.title = 'Favori'; f.setAttribute('aria-label', 'Ajouter aux favoris');
  f.onclick = e => { e.stopPropagation(); toggleFav(c.id); f.classList.toggle('on', state.favs.has(c.id)); f.textContent = state.favs.has(c.id) ? '★' : '☆'; if (state.view === 'favs') render(); };
  b.append(f);
  b.append(el('div', 'cinfo', `<div class="cname">${esc(c.name)}</div><div class="csub">${esc(catOf(c))}</div>`));
  b.onclick = () => play(c, visible(c));
  b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } };
  return b;
}
function toggleFav(id) {
  state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
  saveFavs(); toast(state.favs.has(id) ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
}

/* ---------- Filtrage & rendu ---------- */
function pool() {
  let l = state.channels;
  if (state.view === 'live' || state.view === 'movies' || state.view === 'series') l = l.filter(c => c.kind === state.view);
  if (state.view === 'favs') l = l.filter(c => state.favs.has(c.id));
  return l;
}
function filtered() {
  let l = pool();
  if (state.cat !== 'all') l = l.filter(c => catOf(c) === state.cat);
  const q = norm(state.query).trim();
  if (q) { const terms = q.split(/\s+/); l = state.channels.filter(c => { const h = norm(c.name + ' ' + c.group); return terms.every(t => h.includes(t)); }); }
  return l;
}
const visible = c => { const l = filtered(); return l.some(x => x.id === c.id) ? l : state.channels.filter(x => catOf(x) === catOf(c)); };

function render() {
  const content = $('#content'), chips = $('#chips'), hero = $('#hero');
  content.innerHTML = ''; chips.innerHTML = '';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view && !state.query));
  if (!state.channels.length) { hero.hidden = true; chips.className = 'chips'; content.append(emptyState()); return; }

  const searching = !!state.query.trim();
  const home = state.view === 'home' && !searching && state.cat === 'all';
  hero.hidden = !home; chips.className = 'chips' + (home ? '' : ' pad');
  if (home) renderHero();

  if (!home) {
    // Catégories
    const base = searching ? [] : pool(); const counts = new Map();
    base.forEach(c => counts.set(catOf(c), (counts.get(catOf(c)) || 0) + 1));
    if (counts.size > 1) {
      chips.append(chip('Tout', 'all', base.length));
      [...counts].sort((a, b) => a[0].localeCompare(b[0], 'fr')).forEach(([k, n]) => chips.append(chip(k, k, n)));
    }
    const list = filtered();
    const title = searching ? `Résultats pour « ${state.query.trim()} »` : ({ home: 'Tout', live: 'Chaînes en direct', movies: 'Films', series: 'Séries', favs: 'Mes favoris' }[state.view]) + (state.cat !== 'all' ? ' · ' + state.cat : '');
    content.append(el('div', 'heading', `<h2>${esc(title)}</h2><span>${list.length} élément${list.length > 1 ? 's' : ''}</span>`));
    if (!list.length) { content.append(el('div', 'empty', state.view === 'favs' && !searching ? '<h2>Aucun favori</h2><p>Touchez ☆ sur une chaîne pour la retrouver ici.</p>' : '<h2>Aucun résultat</h2><p>Essayez un autre mot-clé.</p>')); return; }
    const g = el('div', 'grid'); list.slice(0, state.limit).forEach(c => g.append(card(c))); content.append(g);
    if (list.length > state.limit) { const m = el('button', 'btn ghost more', `Afficher plus (${list.length - state.limit})`); m.onclick = () => { state.limit += 60; render(); }; content.append(m); }
    return;
  }

  // Accueil : rails
  const favs = state.channels.filter(c => state.favs.has(c.id));
  if (favs.length) content.append(rail('⭐ Mes favoris', favs, () => go('favs')));
  const groups = new Map();
  state.channels.forEach(c => { const k = c.kind === 'live' ? catOf(c) : (c.kind === 'movies' ? 'Films' : 'Séries') + ' · ' + catOf(c); (groups.get(k) || groups.set(k, []).get(k)).push(c); });
  [...groups].sort((a, b) => b[1].length - a[1].length).slice(0, 30).forEach(([k, l]) => content.append(rail(k, l, () => { go(l[0].kind === 'live' ? 'live' : l[0].kind, catOf(l[0])); })));
}
function chip(label, key, n) {
  const b = el('button', 'chip' + (state.cat === key ? ' active' : ''), `${esc(label)}<small>${n}</small>`);
  b.onclick = () => { state.cat = key; state.limit = 60; render(); }; return b;
}
function rail(title, list, onMore) {
  const s = el('section', 'rowsec'); const h = el('h2', '', esc(title)); const m = el('button', '', 'Tout voir ›'); m.onclick = onMore; h.append(m); s.append(h);
  const r = el('div', 'rail'), t = el('div', 'track');
  list.slice(0, 40).forEach(c => t.append(card(c)));
  const l = el('button', 'arrow l', '‹'), rr = el('button', 'arrow r', '›');
  l.onclick = () => t.scrollBy({ left: -t.clientWidth * .85, behavior: 'smooth' });
  rr.onclick = () => t.scrollBy({ left: t.clientWidth * .85, behavior: 'smooth' });
  r.append(l, t, rr); s.append(r); return s;
}
function renderHero() {
  const live = state.channels.filter(c => c.kind === 'live'); const pickFrom = live.length ? live : state.channels;
  const c = state.hero && pickFrom.includes(state.hero) ? state.hero : (state.hero = pickFrom[Math.floor(Math.random() * pickFrom.length)]);
  const h = $('#hero'); h.style.setProperty('--hero-bg', `linear-gradient(135deg, ${colorOf(c)}, #0b0d14 90%)`);
  h.innerHTML = `${c.logo ? `<img class="bgimg" referrerpolicy="no-referrer" alt="" src="${esc(c.logo)}" onerror="this.remove()">` : ''}
    <div class="info"><span class="tag">À la une · ${esc(catOf(c))}</span><h1>${esc(c.name)}</h1>
    <p>${c.kind === 'live' ? 'En direct maintenant.' : 'Prêt à regarder.'} ${state.channels.length} titres dans votre bibliothèque.</p>
    <div class="row"><button class="btn play" id="heroPlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Regarder</button>
    <button class="btn play dark" id="heroFav">${state.favs.has(c.id) ? '★ Dans mes favoris' : '☆ Ajouter aux favoris'}</button></div></div>`;
  $('#heroPlay').onclick = () => play(c, visible(c));
  $('#heroFav').onclick = () => { toggleFav(c.id); renderHero(); };
}
function emptyState() {
  const e = el('div', 'empty', '<h2>Bienvenue sur Chud IPTV</h2><p>Ajoutez votre playlist M3U pour commencer, ou essayez la démo.</p>');
  const b = el('button', 'btn', 'Ajouter une source'); b.onclick = () => openSource(); e.append(b); return e;
}
function go(view, cat = 'all') { state.view = view; state.cat = cat; state.limit = 60; $('#search').value = ''; state.query = ''; render(); scrollTo({ top: 0 }); }

/* ---------- Lecteur ---------- */
let hls = null, idleT;
const video = $('#video'), stage = $('.stage');
function play(c, queue) {
  state.current = c; state.queue = queue && queue.length ? queue : [c];
  $('#player').hidden = false; document.body.style.overflow = 'hidden';
  $('#pTitle').textContent = c.name; $('#pSub').textContent = catOf(c);
  syncFav(); buildSide(); load(c);
  history.replaceState(null, '', '#play'); wake();
  if (document.documentElement.requestFullscreen && matchMedia('(max-width:760px)').matches && matchMedia('(orientation:landscape)').matches) document.documentElement.requestFullscreen().catch(() => { });
}
function load(c) {
  teardown(); setStatus('Chargement…'); const u = c.url;
  const fail = m => setStatus(m + ' — essayez ⟳ ou une autre chaîne.');
  video.onplaying = () => setStatus(''); video.onwaiting = () => setStatus('Mise en mémoire tampon…');
  video.onerror = () => { if (!hls) fail('Lecture impossible'); };
  const isHls = /\.m3u8(\?|$)/i.test(u) || !/\.(mp4|mkv|webm|ts|mp3|aac)(\?|$)/i.test(u);
  if (isHls && window.Hls && Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return;
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) { setStatus('Connexion perdue, reconnexion…'); hls.startLoad(); }
      else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else fail('Flux indisponible');
    });
    hls.loadSource(u); hls.attachMedia(video); hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => setStatus('Touchez ▶ pour lancer')));
  } else { video.src = u; video.play().catch(() => { }); }
}
function teardown() { if (hls) { hls.destroy(); hls = null; } video.removeAttribute('src'); video.load(); }
function closePlayer() {
  teardown(); $('#player').hidden = true; document.body.style.overflow = ''; state.current = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  if (location.hash === '#play') history.replaceState(null, '', location.pathname); render();
}
function zap(d) {
  const q = state.queue; if (q.length < 2) return; const i = q.findIndex(x => x.id === state.current.id);
  play(q[(i + d + q.length) % q.length], q);
}
function setStatus(t) { $('#status').textContent = t; }
function syncFav() { const on = state.favs.has(state.current.id); const b = $('#pFav'); b.textContent = on ? '★' : '☆'; b.classList.toggle('on', on); }
function buildSide() {
  const s = $('#sideItems'); s.innerHTML = '';
  state.queue.slice(0, 200).forEach(c => {
    const b = el('button', 'sitem' + (c.id === state.current.id ? ' cur' : ''));
    const m = el('span', 'mini', esc(initials(c.name))); m.style.setProperty('--c1', colorOf(c));
    if (c.logo) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.onload = () => { m.textContent = ''; m.append(i); }; i.src = c.logo; }
    b.append(m, el('div', '', `<div class="cname">${esc(c.name)}</div><div class="csub">${esc(catOf(c))}</div>`));
    b.onclick = () => play(c, state.queue); s.append(b);
  });
  s.querySelector('.cur')?.scrollIntoView({ block: 'center' });
}
function wake() { stage.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => !video.paused && stage.classList.add('idle'), 3500); }
['mousemove', 'touchstart', 'click', 'keydown'].forEach(e => $('#player').addEventListener(e, wake, { passive: true }));
$('#closePlayer').onclick = closePlayer;
$('#prevCh').onclick = () => zap(-1); $('#nextCh').onclick = () => zap(1);
$('#pReload').onclick = () => load(state.current);
$('#pFav').onclick = () => { toggleFav(state.current.id); syncFav(); };
addEventListener('popstate', () => { if (!$('#player').hidden) closePlayer(); });
addEventListener('keydown', e => {
  if (!$('#player').hidden) {
    if (e.key === 'Escape') closePlayer();
    else if (e.key === 'ArrowRight') zap(1); else if (e.key === 'ArrowLeft') zap(-1);
    else if (e.key.toLowerCase() === 'f' && !e.ctrlKey) { toggleFav(state.current.id); syncFav(); }
    else if (e.key.toLowerCase() === 'm') video.muted = !video.muted;
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#search').focus(); }
});

/* ---------- Source ---------- */
const dlg = $('#sourceDlg');
function openSource() { $('#srcErr').textContent = ''; dlg.showModal(); }
$('#addSource').onclick = openSource; $('#srcCancel').onclick = () => dlg.close();
$('#loadDemo').onclick = () => { setChannels(parseM3U(DEMO_M3U)); dlg.close(); toast('Démo chargée'); };
$('#sourceForm').onsubmit = async e => {
  e.preventDefault(); const err = $('#srcErr'), ok = $('#srcOk'); err.textContent = '';
  const url = $('#srcUrl').value.trim(), file = $('#srcFile').files[0];
  if (!url && !file) { err.textContent = 'Indiquez une URL ou choisissez un fichier.'; return; }
  ok.disabled = true; ok.textContent = 'Import…';
  try {
    const text = file ? await file.text() : await (await fetch(url)).text();
    const list = parseM3U(text); if (!list.length) throw new Error('Aucune chaîne trouvée dans ce fichier.');
    setChannels(list); store.set('source', url || ''); dlg.close(); toast(`${list.length} éléments importés`);
  } catch (x) { err.textContent = x instanceof TypeError ? 'Impossible de joindre cette URL (réseau ou CORS). Importez plutôt le fichier.' : x.message; }
  finally { ok.disabled = false; ok.textContent = 'Importer'; }
};
function setChannels(list) {
  state.channels = list; state.hero = null; state.favs = new Set([...state.favs].filter(id => list.some(c => c.id === id)) );
  if (!store.set('channels', list)) toast('Playlist trop volumineuse pour être mémorisée');
  saveFavs(); go('home');
}

/* ---------- Navigation / recherche ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { e.preventDefault(); go(b.dataset.view); } });
let st; $('#search').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => { state.query = e.target.value; state.limit = 60; render(); }, 150); });
$('#bnSearch').onclick = () => { scrollTo({ top: 0 }); $('#search').focus(); };
addEventListener('scroll', () => $('#topbar').classList.toggle('solid', scrollY > 30), { passive: true });
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2000); }

/* ---------- Démarrage ---------- */
render();
