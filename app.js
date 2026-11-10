// Temple of Artemis Leukophryene — 360° viewpoints + studio viewer (three.js, WebXR). F. Saed, PoliTo 2026.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);
const UA = navigator.userAgent;
const IS_QUEST = /OculusBrowser|Quest|Meta/i.test(UA);
const IS_MOBILE = !IS_QUEST && /Android|iPhone|iPad|iPod/i.test(UA);
const PLAN_SCALE = 0.025;          // VR floor plan: 1:40
const MARKER_R = 20;               // marker distance inside the panorama sphere (m)

// ------------------------------------------------------------------ renderer, scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(0.3);
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 500);
scene.add(camera);
const rig = new THREE.Group();              // holds the camera + controllers in VR; turned so the user first faces east
rig.rotation.y = Math.PI / 2;
scene.add(rig);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ------------------------------------------------------------------ data
const [PANOS, OBJECTS, PLAN] = await Promise.all(['data/panoramas.json', 'data/objects.json', 'data/plan.json']
  .map((u) => fetch(u).then((r) => r.json())));
const panoById = Object.fromEntries(PANOS.panoramas.map((p) => [p.id, p]));
const objById = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));
// ------------------------------------------------------------------ language (EN / IT)
const STR = {
  en: { kicker: 'Magnesia on the Maeander · c. 200 BC', title: 'Temple of Artemis Leukophryene',
    lead: 'An evidence-based, AI-assisted HBIM reconstruction. Four 360° viewpoints; the rings mark the reconstructed elements. Select a ring to study the element in the studio, at its real size.',
    view2d: 'View on this screen', enterVR: 'Enter VR', checkVR: 'Checking VR…', noVR: 'VR not available on this device', needHttps: 'VR needs a headset browser (https)',
    credits: 'Farbod Saed · Politecnico di Torino · supervisor Prof. Elisabetta Caterina Giovannini',
    offline: 'Save for offline use', offNo: 'Offline use is not supported in this browser.', offSaving: 'Saving', offDone: 'Saved: {n} files. The page now works without internet in this browser.',
    ready8: 'Ready · 8K panoramas', ready4: 'Ready · 4K panoramas', loading: 'Loading', viewpoint: 'Viewpoint',
    mapTitle: 'Temple of Artemis', mapSub: 'Magnesia on the Maeander · plan', here: 'here',
    hint: 'Drag to look around · select a ring to open the element · use the plan to move',
    studioHint: 'Drag to turn · right-drag or two fingers to move · scroll or pinch to zoom',
    size: 'Size', evidence: 'Evidence', source: 'Source', back: '← Back to the temple', reset: 'Reset view', high: 'high',
    vrBack: 'Back to the temple', vrReset: 'Reset',
    vrHint: 'Trigger + twist: turn · left stick: up / down · right stick: turn, nearer / farther · grip: back',
    programme: 'Master’s Degree Programme in Architecture for Sustainability', date: 'December 2026',
    pre: 'THE TEMPLE OF', name: 'ARTEMIS', epithet: 'LEUKOPHRYENE', place: 'MAGNESIA ON THE MAEANDER',
    claim: 'An evidence-based, AI-assisted HBIM reconstruction', sup: 'Supervisor  Prof. Elisabetta Caterina Giovannini',
    enter: 'Enter the temple', scroll: 'Scroll to enter', preparing: 'Preparing the temple',
    map: 'Plan', mapOpen: 'Show the plan', close: 'Close', home: 'Back to the start page', info: 'About this element' },
  it: { kicker: 'Magnesia al Meandro · c. 200 a.C.', title: 'Tempio di Artemide Leucofriene',
    lead: 'Una ricostruzione HBIM basata sulle evidenze e assistita dall’IA. Quattro punti di vista a 360°; gli anelli segnano gli elementi ricostruiti. Seleziona un anello per studiare l’elemento nello studio, in scala reale.',
    view2d: 'Guarda su questo schermo', enterVR: 'Entra in VR', checkVR: 'Verifica VR…', noVR: 'VR non disponibile su questo dispositivo', needHttps: 'La VR richiede il browser di un visore (https)',
    credits: 'Farbod Saed · Politecnico di Torino · relatrice Prof.ssa Elisabetta Caterina Giovannini',
    offline: 'Salva per l’uso offline', offNo: 'L’uso offline non è supportato da questo browser.', offSaving: 'Salvataggio', offDone: 'Salvati {n} file. Ora la pagina funziona senza internet in questo browser.',
    ready8: 'Pronto · panorami 8K', ready4: 'Pronto · panorami 4K', loading: 'Caricamento', viewpoint: 'Punto di vista',
    mapTitle: 'Tempio di Artemide', mapSub: 'Magnesia al Meandro · pianta', here: 'qui',
    hint: 'Trascina per guardarti intorno · seleziona un anello per aprire l’elemento · usa la pianta per spostarti',
    studioHint: 'Trascina per ruotare · tasto destro o due dita per spostare · rotella o pizzico per lo zoom',
    size: 'Dimensioni', evidence: 'Affidabilità', source: 'Fonte', back: '← Torna al tempio', reset: 'Reimposta vista', high: 'di altezza',
    vrBack: 'Torna al tempio', vrReset: 'Reimposta',
    vrHint: 'Grilletto + polso: ruota · stick sinistro: su / giù · stick destro: ruota, avvicina / allontana · grip: indietro',
    programme: 'Corso di Laurea Magistrale in Architettura per la Sostenibilità', date: 'Dicembre 2026',
    pre: 'IL TEMPIO DI', name: 'ARTEMIDE', epithet: 'LEUCOFRIENE', place: 'MAGNESIA AL MEANDRO',
    claim: 'Una ricostruzione HBIM basata sulle evidenze e assistita dall’IA', sup: 'Relatrice  Prof.ssa Elisabetta Caterina Giovannini',
    enter: 'Entra nel tempio', scroll: 'Scorri per entrare', preparing: 'Preparazione del tempio',
    map: 'Pianta', mapOpen: 'Mostra la pianta', close: 'Chiudi', home: 'Torna alla pagina iniziale', info: 'Informazioni sull’elemento' },
};
let LANG = (() => { const q = location.search.match(/[?&]lang=(en|it)/); if (q) return q[1];
  try { return localStorage.getItem('at_lang') || ((navigator.language || '').startsWith('it') ? 'it' : 'en'); } catch (e) { return 'en'; } })();
const T = (k) => (STR[LANG] && STR[LANG][k]) || STR.en[k] || k;
const L = (o, k) => (LANG === 'it' && o[k + '_it']) || o[k];
function num(v) { return v.toLocaleString(LANG === 'it' ? 'it-IT' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
let xrState = 'check', readyShown = false, currentPano = null, current = null;
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = T(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
  document.documentElement.style.setProperty('--langw', $('lang').offsetWidth + 'px');
  const nm = $('h-name'); nm.innerHTML = ''; [...T('name')].forEach((ch, i, a) => {
    const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch;
    sp.style.setProperty('--d', (1.15 + 0.12 * i) + 's'); sp.style.setProperty('--o', (0.03 * Math.abs(i - (a.length - 1) / 2)) + 's'); nm.appendChild(sp); });
  if (window.__layoutHero) window.__layoutHero();
  document.querySelectorAll('#lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
  document.title = T('title') + ' · VR';
  $('btn-vr').textContent = T({ check: 'checkVR', ok: 'enterVR', no: 'noVR', https: 'needHttps' }[xrState]);
}
function setLang(l) {
  LANG = l; try { localStorage.setItem('at_lang', l); } catch (e) {}
  applyLang();
  if (currentPano) { buildMarkers(currentPano); $('where-name').textContent = L(currentPano, 'title'); drawPlans(); }
  if (current) { fillPanelHTML(current.o); drawVRPanel(); }
  if (readyShown) $('load-status').textContent = HI_RES ? T('ready8') : T('ready4');
}
document.querySelectorAll('#lang button').forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
applyLang();
const HI_RES = !/[?&]lo\b/.test(location.search) && (IS_QUEST || !IS_MOBILE) && renderer.capabilities.maxTextureSize >= 4096;

// ------------------------------------------------------------------ helpers
function canvasTex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(/\s+/); let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function dirFromUV(u, v) {
  const phi = 2 * Math.PI * u, th = Math.PI * v;
  return new THREE.Vector3(Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}
const FONT = '"Jost","Futura","Avenir Next","Segoe UI",system-ui,sans-serif';

// ------------------------------------------------------------------ panorama
const panoGroup = new THREE.Group(); scene.add(panoGroup);
// 8K panoramas come as 2 x 2 tiles of 4096 x 2048 (small files, easy on the GPU); 4K as one image
const sphereGeo = new THREE.SphereGeometry(100, 128, 64); sphereGeo.scale(-1, 1, 1);
const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
const sphere = new THREE.Mesh(sphereGeo, sphereMat); sphere.renderOrder = -10; panoGroup.add(sphere);
const tiles = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
  const g = new THREE.SphereGeometry(100, 64, 32, c * Math.PI, Math.PI, r * Math.PI / 2, Math.PI / 2); g.scale(-1, 1, 1);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })); m.renderOrder = -10; m.visible = false;
  panoGroup.add(m); tiles.push(m);
}
const markerGroup = new THREE.Group(); panoGroup.add(markerGroup);
const texLoader = new THREE.TextureLoader();
const texCache = new Map();

function markerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.lineWidth = 14; g.strokeStyle = 'rgba(255,250,240,0.95)'; g.beginPath(); g.arc(128, 128, 78, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8583a'; g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.fill();
  return canvasTex(c);
}
const MARKER_TEX = markerTexture();
function labelSprite(title, sub) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 220; const g = c.getContext('2d');
  g.font = `500 64px ${FONT}`; const w1 = g.measureText(title).width;
  g.font = `400 40px ${FONT}`; const w2 = g.measureText(sub || '').width;
  const w = Math.min(1000, Math.max(w1, w2) + 70);
  g.fillStyle = 'rgba(10,11,20,0.82)'; roundRect(g, (1024 - w) / 2, 10, w, sub ? 190 : 110, 26); g.fill();
  g.fillStyle = '#ece6da'; g.textAlign = 'center'; g.font = `500 64px ${FONT}`; g.fillText(title, 512, 88);
  if (sub) { g.fillStyle = '#f07455'; g.font = `400 40px ${FONT}`; g.fillText(sub, 512, 160); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), depthTest: false, transparent: true, toneMapped: false }));
  s.scale.set(6.4, 6.4 * 220 / 1024, 1); s.renderOrder = 12; s.visible = false;
  return s;
}
let markers = [];
function buildMarkers(p) {
  markerGroup.clear(); markers = [];
  for (const h of p.hotspots) {
    const o = objById[h.object]; if (!o) continue;
    const dir = dirFromUV(h.u, h.v);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARKER_TEX, depthTest: false, transparent: true, toneMapped: false }));
    s.position.copy(dir).multiplyScalar(MARKER_R); s.scale.setScalar(1.1); s.renderOrder = 11;
    s.userData = { obj: o.id, base: 1.1 };
    const lab = labelSprite(L(o, 'title'), L(o, 'sub'));
    lab.position.copy(dir).multiplyScalar(MARKER_R - 0.5); lab.position.y -= 1.3;
    s.userData.label = lab;
    markerGroup.add(s, lab); markers.push(s);
  }
}
function panoUrls(p) { return HI_RES ? p.image_tiles : [p.image_phone]; }
async function loadPanoTexture(p) {
  const key = p.id;
  if (texCache.has(key)) return texCache.get(key);
  const ts = await Promise.all(panoUrls(p).map((u) => texLoader.loadAsync(u)));
  for (const t of ts) {
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  if (texCache.size >= 2) { const [k, old] = texCache.entries().next().value; old.forEach((t) => t.dispose()); texCache.delete(k); }
  texCache.set(key, ts); return ts;
}

function faceHeading(deg) {                  // turn the view to a world azimuth (east = 0, north = 90)
  const want = THREE.MathUtils.degToRad(deg) + Math.PI / 2;           // camera yaw (three) that looks along that azimuth
  if (renderer.xr.isPresenting) {
    const d = new THREE.Vector3(); renderer.xr.getCamera().getWorldDirection(d);
    const have = Math.atan2(-d.x, -d.z); rig.rotation.y += want - have;
  } else if (!HERO.active) { lookYaw = THREE.MathUtils.degToRad(deg); lookPitch = 0; applyLook(); }
}
async function goPano(id, { fade = true } = {}) {
  const p = panoById[id]; if (!p) return;
  showLoading(T('loading') + ' · ' + L(p, 'title'));
  const tex = await loadPanoTexture(p);
  if (fade) await fadeTo(1, 220);
  if (tex.length === 4) {
    sphere.visible = false;
    tiles.forEach((m, i) => { m.material.map = tex[i]; m.material.color.set(0xffffff); m.material.needsUpdate = true; m.visible = true; });
  } else {
    tiles.forEach((m) => { m.visible = false; });
    sphere.visible = true; sphereMat.map = tex[0]; sphereMat.color.set(0xffffff); sphereMat.needsUpdate = true;
  }
  panoGroup.rotation.y = THREE.MathUtils.degToRad(p.yaw_deg || 0);
  currentPano = p; buildMarkers(p); drawPlans(); $('where-name').textContent = L(p, 'title');
  faceHeading(p.heading_deg || 0);
  hideLoading();
  if (fade) await fadeTo(0, 320);
  // pre-load the neighbours quietly
  for (const q of PANOS.panoramas) if (q.id !== id) for (const u of panoUrls(q)) fetch(u).catch(() => {});
}

// ------------------------------------------------------------------ plans (2D overlay + VR floor)
const planImg = new Image(); planImg.src = 'img/plan_v3.png';
await planImg.decode().catch(() => {});
const planCv = document.createElement('canvas'); planCv.width = planImg.naturalWidth || 2304; planCv.height = planImg.naturalHeight || 1272;
const planTex = canvasTex(planCv);
function w2p(X, Y, W, H) { return [(X - PLAN.x0) / (PLAN.x1 - PLAN.x0) * W, (PLAN.y1 - Y) / (PLAN.y1 - PLAN.y0) * H]; }
let miniHover = null;
function drawPlanOn(ctx, W, H, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  const k = W / planImg.naturalWidth * (2304 / 2304);
  if (opts.vr) {                                                  // VR floor: dark rounded plate + title
    ctx.fillStyle = 'rgba(10,10,13,0.80)'; roundRect(ctx, 0, 0, W, H, 60 * k); ctx.fill();
    ctx.strokeStyle = 'rgba(232,88,58,0.45)'; ctx.lineWidth = 4 * k; roundRect(ctx, 3 * k, 3 * k, W - 6 * k, H - 6 * k, 58 * k); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8583a'; ctx.font = `500 ${40 * k}px ${FONT}`;
    ctx.fillText(T('mapTitle').toUpperCase(), 60 * k, 70 * k);
    ctx.fillStyle = '#a39c8f'; ctx.font = `300 ${32 * k}px ${FONT}`; ctx.fillText(T('mapSub'), 60 * k, 112 * k);
  }
  ctx.drawImage(planImg, 0, 0, W, H);
  for (const p of PANOS.panoramas) {
    const [x, y] = w2p(p.eye_m[0], p.eye_m[1], W, H); const cur = currentPano && p.id === currentPano.id;
    if (cur && opts.yaw !== undefined) {                         // view cone, soft
      const g = ctx.createRadialGradient(x, y, 0, x, y, 230 * k);
      g.addColorStop(0, 'rgba(232,88,58,0.55)'); g.addColorStop(1, 'rgba(232,88,58,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 230 * k, -opts.yaw - 0.5, -opts.yaw + 0.5); ctx.closePath(); ctx.fill();
    }
    if (cur) {
      ctx.fillStyle = 'rgba(232,88,58,0.28)'; ctx.beginPath(); ctx.arc(x, y, 46 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8583a'; ctx.beginPath(); ctx.arc(x, y, 22 * k, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff6ec'; ctx.lineWidth = 5 * k; ctx.stroke();
    } else {
      ctx.strokeStyle = miniHover === p.id ? '#ffffff' : '#f1e9d9'; ctx.lineWidth = 7 * k;
      ctx.beginPath(); ctx.arc(x, y, 24 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8583a'; ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, Math.PI * 2); ctx.fill();
    }
    if (opts.labels || miniHover === p.id) {
      const fs = (opts.labels ? 44 : 64) * k;
      ctx.font = `400 ${fs}px ${FONT}`; ctx.textAlign = x < W * 0.2 ? 'left' : (x > W * 0.8 ? 'right' : 'center');
      const ty = y + (p.eye_m[1] > 20 ? -60 : 95) * k;
      ctx.fillStyle = cur ? '#ffffff' : '#ece6da';
      ctx.fillText(cur ? L(p, 'title') + ' · ' + T('here') : L(p, 'title'), x, ty);
    }
  }
}
const mini = $('minimap'); const miniCtx = mini.getContext('2d');
function camYawWorld() {                     // world azimuth of the view (east = 0, north = +90 deg)
  const d = new THREE.Vector3(); (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldDirection(d);
  return Math.atan2(d.z, -d.x);              // three (x,z) = (-dX, dY)
}
function drawPlans() {
  drawPlanOn(planCv.getContext('2d'), planCv.width, planCv.height, { labels: true, vr: true }); planTex.needsUpdate = true;
  drawMini();
}
function drawMini() {
  if ($('hud').classList.contains('hidden') || $('mapbox').classList.contains('closed')) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(mini.clientWidth * dpr), h = Math.round(mini.clientHeight * dpr);
  if (!w || !h) return;
  if (mini.width !== w || mini.height !== h) { mini.width = w; mini.height = h; }
  drawPlanOn(miniCtx, w, h, { yaw: camYawWorld(), labels: false });
}
function miniPano(e, maxD) {
  const r = mini.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  return nearestPano(PLAN.x0 + fx * (PLAN.x1 - PLAN.x0), PLAN.y1 - fy * (PLAN.y1 - PLAN.y0), maxD);
}
mini.addEventListener('click', (e) => { const best = miniPano(e, 8); if (best && best.id !== currentPano.id) goPano(best.id); });
mini.addEventListener('mousemove', (e) => { const p = miniPano(e, 6); miniHover = p ? p.id : null; mini.style.cursor = p ? 'pointer' : 'default'; });
mini.addEventListener('mouseleave', () => { miniHover = null; });
function nearestPano(X, Y, maxD = 6) {
  let best = null, bd = maxD;
  for (const p of PANOS.panoramas) { const d = Math.hypot(p.eye_m[0] - X, p.eye_m[1] - Y); if (d < bd) { bd = d; best = p; } }
  return best;
}
// VR floor plan: world (X east, Y north) -> three (x, z) = (-(X-ex), (Y-ey)) * scale, under the user
const floorPlan = new THREE.Mesh(new THREE.BufferGeometry(),
  new THREE.MeshBasicMaterial({ map: planTex, transparent: true, opacity: 0.92, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
floorPlan.renderOrder = 5; floorPlan.visible = false; scene.add(floorPlan);
function layoutFloorPlan() {
  const [ex, ey] = currentPano.eye_m; const s = PLAN_SCALE;
  const P = (X, Y) => [-(X - ex) * s, 0.015, (Y - ey) * s];
  const c = [P(PLAN.x0, PLAN.y1), P(PLAN.x1, PLAN.y1), P(PLAN.x0, PLAN.y0), P(PLAN.x1, PLAN.y0)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(c.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  g.setIndex([0, 2, 1, 2, 3, 1]); g.computeBoundingSphere();
  floorPlan.geometry.dispose(); floorPlan.geometry = g;
  floorPlan.position.set(xrOrigin().x, 0, xrOrigin().z);
}
function xrOrigin() { const v = new THREE.Vector3(); rig.getWorldPosition(v); return v; }
function floorPlanHit(uv) {
  const X = PLAN.x0 + uv.x * (PLAN.x1 - PLAN.x0), Y = PLAN.y0 + uv.y * (PLAN.y1 - PLAN.y0);
  return nearestPano(X, Y, 5);
}

// ------------------------------------------------------------------ studio
const studio = new THREE.Group(); studio.visible = false; scene.add(studio);
const holder = new THREE.Group(); studio.add(holder);     // positioned in front of the viewer; children rotate/scale
const pivot = new THREE.Group(); holder.add(pivot);
const keyL = new THREE.DirectionalLight(0xfff1dc, 3.2); keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048);
keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.02;
const fillL = new THREE.DirectionalLight(0xcfdcff, 0.7);
const rimL = new THREE.DirectionalLight(0xffffff, 2.6);
const rimL2 = new THREE.DirectionalLight(0xffd9a0, 1.4);
const hemi = new THREE.HemisphereLight(0x8a8f99, 0x0c0b0a, 0.18);
for (const l of [keyL, fillL, rimL, rimL2]) { holder.add(l); holder.add(l.target); }
studio.add(hemi);
function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, 'rgb(58,52,44)'); grd.addColorStop(0.18, 'rgb(34,31,28)'); grd.addColorStop(0.55, 'rgb(14,14,15)'); grd.addColorStop(1, 'rgb(9,9,11)');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512); return canvasTex(c);
}
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshBasicMaterial({ map: poolTexture(), toneMapped: false }));
floor.rotation.x = -Math.PI / 2; studio.add(floor);
const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.55 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.002; shadowCatcher.receiveShadow = true; studio.add(shadowCatcher);
const STUDIO_BG = new THREE.Color(0x09090b);

const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const modelCache = new Map();
async function loadModel(o) {
  if (modelCache.has(o.id)) return modelCache.get(o.id);
  const g = await gltf.loadAsync(o.glb, (e) => { if (e.total) showLoading(`${T('loading')} · ${L(o, 'title')} ${Math.round(100 * e.loaded / e.total)}%`); });
  const root = g.scene;
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const mat = m.material; if (mat.metalness > 0.5) { mat.envMap = envTex; mat.envMapIntensity = 0.9; }
    if (mat.name === 'marble') { mat.roughness = 0.6; mat.color.set(0xd8d0c2); }
    if (mat.name === 'timber') { mat.roughness = 0.65; mat.color.set(0x6e4a30); }
    if (mat.name === 'gold') { mat.roughness = 0.3; mat.color.set(0xd9b066); }
  });
  const box = new THREE.Box3().setFromObject(root); const c = box.getCenter(new THREE.Vector3());
  root.position.sub(c);                                            // centre at the pivot
  const size = box.getSize(new THREE.Vector3());
  const rec = { root, size, maxDim: Math.max(size.x, size.y, size.z) };
  modelCache.set(o.id, rec); return rec;
}

let orbit = null;
function placeStudio() {
  const { rec } = current;                                          // always the real size (1:1)
  current.baseScale = 1; pivot.scale.setScalar(zoom);
  const h = rec.size.y, R = rec.maxDim / 2;
  const cy = 0.35 + h / 2;                                          // floating 35 cm above the floor
  const dist = Math.max(1.9, R * 0.9 + 1.2);
  // viewer position and forward (horizontal)
  const head = new THREE.Vector3(), fwd = new THREE.Vector3();
  if (renderer.xr.isPresenting) {
    const xc = renderer.xr.getCamera(); xc.getWorldPosition(head); xc.getWorldDirection(fwd);
  } else { head.set(0, 1.5, 0); fwd.set(0, 0, -1); }
  fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
  holder.position.set(head.x + fwd.x * dist, cy, head.z + fwd.z * dist);
  holder.rotation.set(0, Math.atan2(-fwd.x, -fwd.z), 0);          // holder -Z looks back at the viewer... keep model front (+Z) facing viewer
  floor.position.set(holder.position.x, 0, holder.position.z);
  shadowCatcher.position.set(holder.position.x, 0.002, holder.position.z);
  // lights relative to the holder (holder +Z points at the viewer)
  const L = Math.max(R, 0.8) * 4;
  keyL.position.set(-1.25 * L, 1.0 * L, 0.55 * L); fillL.position.set(1.2 * L, 0.2 * L, 0.9 * L);
  rimL.position.set(0.7 * L, 0.9 * L, -1.2 * L); rimL2.position.set(-1.0 * L, 0.2 * L, -0.9 * L);
  for (const l of [keyL, fillL, rimL, rimL2]) l.target.position.set(0, 0, 0);
  const sc = keyL.shadow.camera; const e = Math.max(R * 1.6, cy + R);
  sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 0.1; sc.far = L * 4; sc.updateProjectionMatrix();
  shadowCatcher.scale.setScalar(Math.max(1, R * 1.3));
  current.home = holder.position.clone(); current.homeQ = holder.quaternion.clone();
  if (orbit && !renderer.xr.isPresenting) {
    orbit.target.copy(holder.position);
    const fit = Math.max(R, h / 2 * 1.05) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    const camDist = Math.max(1.2, fit * 1.08);
    camera.position.set(holder.position.x, holder.position.y + 0.05 * h, holder.position.z + camDist);
    orbit.minDistance = 0.3; orbit.maxDistance = camDist * 4 + 5;
    orbit._panOffset.set(0, 0, 0); orbit._sphericalDelta.set(0, 0, 0); orbit._scale = 1; orbit._performCursorZoom = false;   // drop motion left from the last object
    orbit.update();
  }
  positionPanel();
}
async function openObject(id) {
  const o = objById[id]; if (!o) return;
  showLoading(T('loading') + ' · ' + L(o, 'title'));
  let rec; try { rec = await loadModel(o); } catch (e) { hideLoading(); console.error(e); return; }
  await fadeTo(1, 250);
  pivot.clear(); pivot.add(rec.root); pivot.quaternion.identity(); spinIdle = true; zoom = 1;
  current = { o, rec };
  panoGroup.visible = false; floorPlan.visible = false; studio.visible = true;
  scene.background = STUDIO_BG; scene.environment = envTex; scene.environmentIntensity = 0.28;
  if (!renderer.xr.isPresenting) {
    orbit = orbit || new OrbitControls(camera, renderer.domElement);
    if (!orbit.__at) {
      orbit.__at = true; orbit.enableDamping = true; orbit.dampingFactor = 0.08;
      orbit.enablePan = true; orbit.screenSpacePanning = true; orbit.panSpeed = 1.0; orbit.zoomToCursor = true;
      orbit.listenToKeyEvents(window);                              // arrow keys pan too
      orbit.addEventListener('start', () => { spinIdle = false; });
    }
    orbit.enabled = true;
    document.body.classList.add('studio');
    $('hud').classList.add('hidden'); $('studio-ui').classList.remove('hidden'); fillPanelHTML(o);
    infoOpen = !COMPACT.matches; document.body.classList.toggle('info-open', infoOpen); setViewOffset(true);
  }
  drawVRPanel(); placeStudio(); hideLoading();
  await fadeTo(0, 350);
}
async function closeObject() {
  await fadeTo(1, 220);
  studio.visible = false; panoGroup.visible = true; scene.background = null; scene.environment = null;
  if (orbit) { orbit.enabled = false; }
  if (!renderer.xr.isPresenting) {
    camera.position.set(0, 0, 0); applyLook(); setViewOffset(false); document.body.classList.remove('studio');
    $('studio-ui').classList.add('hidden'); $('hud').classList.remove('hidden');
  } else { layoutFloorPlan(); floorPlan.visible = true; }
  current = null; vrPanel.visible = false;
  await fadeTo(0, 320);
}
function resetStudio() { if (!current) return; pivot.quaternion.identity(); zoom = 1; spinIdle = false; placeStudio(); }
function sizeText(o) { const [x, y, z] = o.size_m; return `${num(x)} × ${num(z)} m, ${num(y)} m ${T('high')}`; }
function fillPanelHTML(o) {
  $('p-sub').textContent = L(o, 'sub'); $('p-title').textContent = L(o, 'title'); $('p-text').textContent = L(o, 'text');
  $('p-size').textContent = sizeText(o); $('p-ev').textContent = L(o, 'ev'); $('p-src').textContent = o.src;
  const img = $('p-img'); if (o.image) { img.src = o.image; img.classList.remove('hidden'); } else img.classList.add('hidden');
}
$('btn-back').onclick = closeObject; $('btn-reset').onclick = resetStudio;

// VR info panel (canvas texture) with three buttons
const PW = 1024, PH = 1400;
const panelCv = document.createElement('canvas'); panelCv.width = PW; panelCv.height = PH;
const panelTex = canvasTex(panelCv);
const vrPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78 * PH / PW),
  new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, depthTest: true, toneMapped: false }));
vrPanel.visible = false; scene.add(vrPanel);
let panelButtons = [];
const imgCache = new Map();
function getImg(src) {
  if (!imgCache.has(src)) { const im = new Image(); im.onload = () => drawVRPanel(); im.src = src; imgCache.set(src, im); }
  return imgCache.get(src);
}
function drawVRPanel(hover = -1) {
  if (!current) return; const o = current.o; const g = panelCv.getContext('2d');
  g.clearRect(0, 0, PW, PH); g.fillStyle = 'rgba(14,14,18,0.9)'; roundRect(g, 0, 0, PW, PH, 36); g.fill();
  g.strokeStyle = 'rgba(232,88,58,0.45)'; g.lineWidth = 3; roundRect(g, 2, 2, PW - 4, PH - 4, 34); g.stroke();
  let y = 92; g.textAlign = 'left';
  g.fillStyle = '#e8583a'; g.font = `500 30px ${FONT}`; g.fillText(L(o, 'sub').toUpperCase(), 60, y); y += 70;
  g.fillStyle = '#ece6da'; g.font = `300 62px ${FONT}`; y = wrapText(g, L(o, 'title'), 60, y, PW - 120, 70) + 10;
  if (o.image) { const im = getImg(o.image); if (im.complete && im.naturalWidth) { const h = (PW - 120) * im.naturalHeight / im.naturalWidth; g.drawImage(im, 60, y, PW - 120, h); y += h + 30; } }
  g.fillStyle = '#ddd6c8'; g.font = `400 32px ${FONT}`; y = wrapText(g, L(o, 'text'), 60, y + 10, PW - 120, 44) + 16;
  g.font = `400 26px ${FONT}`;
  for (const [k, v] of [[T('size').toUpperCase(), sizeText(o)], [T('evidence').toUpperCase(), L(o, 'ev')], [T('source').toUpperCase(), o.src]]) {
    g.fillStyle = '#e8583a'; g.fillText(k, 60, y); g.fillStyle = '#a39c8f'; y = wrapText(g, v, 230, y, PW - 290, 36) + 8;
  }
  const labels = [T('vrBack'), T('vrReset')];
  const ws = [420, 260]; let x = 60; const by = PH - 170; panelButtons = [];
  labels.forEach((t, i) => {
    g.fillStyle = i === 0 ? (hover === 0 ? '#f26b4c' : '#e8583a') : (hover === i ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)');
    roundRect(g, x, by, ws[i], 90, 45); g.fill();
    g.strokeStyle = 'rgba(236,230,218,0.35)'; g.lineWidth = 2; if (i) g.stroke();
    g.fillStyle = i === 0 ? '#fff6ec' : '#ece6da'; g.font = `600 32px ${FONT}`; g.textAlign = 'center'; g.fillText(t, x + ws[i] / 2, by + 56); g.textAlign = 'left';
    panelButtons.push({ x0: x / PW, x1: (x + ws[i]) / PW, y0: 1 - (by + 90) / PH, y1: 1 - by / PH, act: [closeObject, resetStudio][i] });
    x += ws[i] + 22;
  });
  g.fillStyle = '#7d776c'; g.font = `400 24px ${FONT}`;
  wrapText(g, T('vrHint'), 60, PH - 50, PW - 120, 30);
  panelTex.needsUpdate = true;
}
function positionPanel() {
  if (!renderer.xr.isPresenting || !current) { vrPanel.visible = false; return; }
  const head = new THREE.Vector3(); renderer.xr.getCamera().getWorldPosition(head);
  const q = current.homeQ || holder.quaternion;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const toView = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  vrPanel.position.copy(head).add(toView.multiplyScalar(-1.1)).add(right.multiplyScalar(0.75)); vrPanel.position.y = head.y - 0.12;
  vrPanel.lookAt(head.x, vrPanel.position.y, head.z); vrPanel.visible = true;
}

// ------------------------------------------------------------------ fade + loading
const fadeMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, depthTest: false }));
fadeMesh.position.z = -0.15; fadeMesh.renderOrder = 100; camera.add(fadeMesh);
function fadeTo(target, ms) {
  return new Promise((res) => {
    const m = fadeMesh.material, a0 = m.opacity, t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); m.opacity = a0 + (target - a0) * k; k < 1 ? requestAnimationFrame(step) : res(); };
    if (renderer.xr.isPresenting) { m.opacity = target; setTimeout(res, ms * 0.6); } else step();
  });
}
let loadingTimer = 0;
function showLoading(t) { $('loading-text').textContent = t; clearTimeout(loadingTimer); loadingTimer = setTimeout(() => $('loading').classList.remove('hidden'), 150); }
function hideLoading() { clearTimeout(loadingTimer); $('loading').classList.add('hidden'); }

// ------------------------------------------------------------------ 2D look controls (pano mode)
let lookYaw = 0, lookPitch = 0, spinIdle = true, zoom = 1;
function applyLook() { camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = lookYaw + Math.PI / 2; camera.rotation.x = lookPitch; }
const ptr = { down: false, x: 0, y: 0, moved: 0, pinch: 0 };
const pointers = new Map();
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, e); ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = 0;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; ptr.pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (current || HERO.active) return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    camera.fov = THREE.MathUtils.clamp(camera.fov * ptr.pinch / d, 30, 95); camera.updateProjectionMatrix(); ptr.pinch = d; ptr.moved = 99; return;
  }
  if (!ptr.down) { hoverPick(e); return; }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.abs(dx) + Math.abs(dy);
  const k = camera.fov / innerHeight * Math.PI / 180;
  const sg = e.pointerType === 'mouse' ? -1 : 1;                 // mouse: the view turns with the mouse; touch: drag the picture
  lookYaw += sg * dx * k; lookPitch = THREE.MathUtils.clamp(lookPitch + sg * dy * k, -1.45, 1.45); applyLook();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId); ptr.down = pointers.size > 0;
  if (HERO.active) { enterTemple(); return; }
  if (!current && ptr.moved < 6) clickPick(e);
});
renderer.domElement.addEventListener('wheel', (e) => {
  if (current || HERO.active) return; camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 30, 95); camera.updateProjectionMatrix();
}, { passive: true });
const ray = new THREE.Raycaster(); ray.camera = camera;
function pickMarker(e) {
  const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  ray.setFromCamera(v, camera); const hit = ray.intersectObjects(markers, false)[0]; return hit && hit.object;
}
let hovered = null;
function setHover(m) {
  if (hovered === m) return;
  if (hovered) { hovered.scale.setScalar(hovered.userData.base); hovered.userData.label.visible = false; }
  hovered = m; if (m) { m.scale.setScalar(m.userData.base * 1.35); m.userData.label.visible = true; }
  renderer.domElement.style.cursor = m ? 'pointer' : '';
}
function hoverPick(e) { setHover(pickMarker(e)); }
function clickPick(e) { const m = pickMarker(e); if (m) openObject(m.userData.obj); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeObject(); });
const COMPACT = matchMedia('(max-width:760px), (max-height:500px)');
let infoOpen = false;
function setInfo(open) { infoOpen = open; document.body.classList.toggle('info-open', open); setViewOffset(!!current); }
$('s-info').onclick = () => setInfo(!infoOpen); $('p-close').onclick = () => setInfo(false);
$('s-back').onclick = () => closeObject(); $('s-reset').onclick = () => resetStudio();
function setViewOffset(on) {
  if (on && !renderer.xr.isPresenting) {
    const W = innerWidth, H = innerHeight;
    if (!COMPACT.matches) camera.setViewOffset(W, H, Math.min(420, W) / 2, 0, W, H);
    else if (!infoOpen) camera.clearViewOffset();
    else if (W <= 760) camera.setViewOffset(W, H, 0, H * 0.26, W, H);
    else camera.setViewOffset(W, H, Math.min(W * 0.5, 420) / 2, 0, W, H);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; renderer.setSize(innerWidth, innerHeight); setViewOffset(!!current); });

// ------------------------------------------------------------------ WebXR
const controllers = [];
const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.8 }));
  line.scale.z = 5; c.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
  dot.renderOrder = 50; dot.visible = false; c.add(dot);
  c.userData = { line, dot, hover: null, drag: null, gamepad: null };
  c.addEventListener('connected', (e) => { c.userData.gamepad = e.data.gamepad; c.userData.hand = !!e.data.hand; c.userData.side = e.data.handedness; });
  c.addEventListener('disconnected', () => { c.userData.gamepad = null; });
  c.addEventListener('selectstart', () => onSelectStart(c));
  c.addEventListener('selectend', () => onSelectEnd(c));
  c.addEventListener('squeezestart', () => { if (current) closeObject(); else floorPlan.visible = !floorPlan.visible; });
  rig.add(c); controllers.push(c);
}
const tmpM = new THREE.Matrix4();
function ctrlRay(c) { tmpM.identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); }
function xrHit(c) {
  ctrlRay(c);
  if (current) {
    const h = ray.intersectObject(vrPanel, false)[0];
    if (h) { const b = panelButtons.findIndex((p) => h.uv.x >= p.x0 && h.uv.x <= p.x1 && h.uv.y >= p.y0 && h.uv.y <= p.y1); return { kind: 'panel', h, b }; }
    const m = ray.intersectObject(pivot, true)[0]; if (m) return { kind: 'model', h: m };
    return null;
  }
  const m = ray.intersectObjects(markers, false)[0]; if (m) return { kind: 'marker', h: m, m: m.object };
  const f = floorPlan.visible && ray.intersectObject(floorPlan, false)[0];
  if (f) return { kind: 'plan', h: f, p: floorPlanHit(f.uv) };
  return null;
}
function onSelectStart(c) {
  const hit = xrHit(c);
  if (current) {
    if (hit && hit.kind === 'panel') { if (hit.b >= 0) panelButtons[hit.b].act(); return; }
    const q = new THREE.Quaternion(); c.getWorldQuaternion(q);
    c.userData.drag = { q0: q.clone(), p0: pivot.quaternion.clone() }; spinIdle = false; return;
  }
  if (!hit) return;
  if (hit.kind === 'marker') openObject(hit.m.userData.obj);
  else if (hit.kind === 'plan' && hit.p && hit.p.id !== currentPano.id) goPano(hit.p.id).then(() => { layoutFloorPlan(); });
}
function onSelectEnd(c) { c.userData.drag = null; }
let panelHover = -1;
function xrFrame(dt) {
  let anyMarker = null, ph = -1;
  for (const c of controllers) {
    const hit = c.visible ? xrHit(c) : null;
    c.userData.line.scale.z = hit ? hit.h.distance : 5;
    c.userData.dot.visible = !!hit; if (hit) c.userData.dot.position.set(0, 0, -hit.h.distance);
    if (hit && hit.kind === 'marker') anyMarker = hit.m;
    if (hit && hit.kind === 'panel') ph = hit.b;
    const d = c.userData.drag;
    if (d && current) {                         // grab-and-twist: apply the controller's rotation change (doubled) to the model
      const q = new THREE.Quaternion(); c.getWorldQuaternion(q);
      const delta = q.multiply(d.q0.clone().invert());
      const ang = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
      const axis = new THREE.Vector3(delta.x, delta.y, delta.z); if (axis.lengthSq() > 1e-8) axis.normalize();
      const hq = holder.getWorldQuaternion(new THREE.Quaternion());
      axis.applyQuaternion(hq.clone().invert());
      const amp = new THREE.Quaternion().setFromAxisAngle(axis, ang * 2 * Math.sign(delta.w || 1));
      pivot.quaternion.copy(amp.multiply(d.p0));
    }
    const gp = c.userData.gamepad;
    if (gp && gp.axes && gp.axes.length >= 4 && current) {
      const ax = gp.axes[2], ay = gp.axes[3];
      if (Math.abs(ax) > 0.15) { pivot.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), ax * dt * 1.8); spinIdle = false; }
      if (Math.abs(ay) > 0.15) {
        if (c.userData.side === 'left') {                           // left stick: lift the object up / down
          holder.position.y = THREE.MathUtils.clamp(holder.position.y - ay * dt * 2.0, -40, 60);
        } else {                                                    // right stick: bring it nearer / push it away
          const head = new THREE.Vector3(); renderer.xr.getCamera().getWorldPosition(head);
          const v = holder.position.clone().sub(head); v.y = 0; const dd = v.length();
          const nd = THREE.MathUtils.clamp(dd * (1 + ay * dt * 1.2), 0.6, 40);
          if (dd > 1e-3) { v.multiplyScalar(nd / dd); holder.position.x = head.x + v.x; holder.position.z = head.z + v.z; }
          floor.position.set(holder.position.x, 0, holder.position.z); shadowCatcher.position.set(holder.position.x, 0.002, holder.position.z);
        }
        spinIdle = false;
      }
    }
  }
  if (!current) setHover(anyMarker);
  if (current && ph !== panelHover) { panelHover = ph; drawVRPanel(ph); }
}
const xrBtn = $('btn-vr');
const SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] };
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    xrBtn.disabled = !ok; xrState = ok ? 'ok' : 'no'; xrBtn.classList.toggle('hidden', !ok); applyLang();
  }).catch(() => { xrState = 'no'; applyLang(); });
} else { xrState = 'https'; xrBtn.classList.add('hidden'); applyLang(); }
xrBtn.onclick = async () => {
  const s = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
  await start(); renderer.xr.setSession(s);
};
renderer.xr.addEventListener('sessionstart', () => {
  scene.remove(camera); rig.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); camera.clearViewOffset(); camera.fov = 75; camera.updateProjectionMatrix();
  $('hud').classList.add('hidden'); $('studio-ui').classList.add('hidden');
  if (orbit) orbit.enabled = false;
  document.body.classList.remove('studio');
  if (current) { placeStudio(); } else { layoutFloorPlan(); floorPlan.visible = true; }
});
renderer.xr.addEventListener('sessionend', () => {
  rig.remove(camera); scene.add(camera); camera.position.set(0, 0, 0); floorPlan.visible = false; vrPanel.visible = false;
  if (current) closeObject(); else { applyLook(); $('hud').classList.remove('hidden'); }
});

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3();
let frame = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const xr = renderer.xr.isPresenting;
  (xr ? renderer.xr.getCamera() : camera).getWorldPosition(camPos);
  panoGroup.position.copy(camPos);                       // the panorama always surrounds the eye
  if (xr) xrFrame(dt);
  if (HERO.active && !xr) heroTick(dt);
  if (current) {
    if (spinIdle) pivot.rotateY(dt * 0.18);
    if (orbit && orbit.enabled) orbit.update();
    if (xr && frame % 30 === 0 && !controllers.some((c) => c.userData.drag)) positionPanel();
  } else if (!xr && (frame++ % 6 === 0)) drawMini();
  frame++;
  renderer.render(scene, camera);
});

// ------------------------------------------------------------------ start page: the book cover, alive
// One shader over the first panorama draws the cover: night sky + red moon, the temple as a red line drawing that
// turns into a point cloud and then into the rendered stone; on "enter" the scan completes, day comes, and the
// camera tilts down into the 360 viewpoint. Aux texture (same equirect as the render): R = edges, G = sky, B = temple.
const HERO = { draw: -20, active: true, shift: -1.25, day: 0, moonA: 0, moonEl: 49, yaw: 0, pitch: 34, fov: 80, t0: performance.now() };
const introU = {
  uPano: { value: null }, uAux: { value: null }, uShift: { value: -1.25 }, uDay: { value: 0 }, uTime: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(-1, 0, 0) }, uMoonR: { value: THREE.MathUtils.degToRad(15.5) }, uMoonA: { value: 0 },
  uSpan: { value: 88 }, uPts: { value: 1500 }, uDraw: { value: -20 },
};
const introMat = new THREE.ShaderMaterial({
  uniforms: introU, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: /* glsl */`varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D uPano, uAux; uniform float uShift, uDay, uTime, uMoonR, uMoonA, uSpan, uPts, uDraw; uniform vec3 uMoonDir;
    varying vec3 vDir;
    #define PI 3.14159265359
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float ss(float a, float b, float x) { return smoothstep(a, b, x); }
    float cloud(vec2 pg, float sth, float dens, float g1, out float hv) {        // one layer of scan points
      vec2 c = floor(pg); float h = hash(c); hv = hash(c + 17.0);
      vec2 o = vec2(hash(c + 7.1), hash(c + 3.7)) * 0.64 + 0.18;
      vec2 l = fract(pg) - o; l.x *= sth;
      float r = mix(0.13, 0.27, g1), d = length(l), aa = max(fwidth(pg.y), 1e-4) * 0.75;
      return (1.0 - smoothstep(r - aa, r + aa, d)) * step(h, dens);
    }
    void main() {
      vec3 d = normalize(vDir);
      float u = fract(atan(d.z, d.x) / (2.0 * PI)), th = acos(clamp(d.y, -1.0, 1.0)), sth = max(sin(th), 0.05);
      vec2 uv = vec2(u, 1.0 - th / PI);
      vec4 ax = texture2D(uAux, uv); vec3 day = texture2D(uPano, uv).rgb;
      float el = 90.0 - degrees(th);
      const vec3 NAVY = vec3(0.040, 0.045, 0.080), VERM = vec3(0.925, 0.345, 0.215), LINE = vec3(0.965, 0.420, 0.270);
      // sky, stars, moon
      vec3 sky0 = mix(NAVY * 0.75, vec3(0.105, 0.085, 0.130), pow(clamp((80.0 - el) / 66.0, 0.0, 1.0), 1.4));
      vec2 sc = vec2(u * 5600.0, th / PI * 2800.0); vec2 ci = floor(sc); float hs = hash(ci + 91.0);
      float star = step(0.9986, hs) * (0.22 + 0.55 * hash(ci + 1.7)) * (0.7 + 0.3 * sin(uTime * (0.8 + 2.0 * hash(ci + 5.3)) + hs * 60.0))
                 * (1.0 - smoothstep(0.18, 0.5, length((fract(sc) - 0.5) * vec2(sth, 1.0) * 1.6))) * ss(6.0, 26.0, el);
      sky0 += star;
      float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0)), aam = fwidth(ang) * 1.2 + 1e-4;
      float disc = smoothstep(uMoonR + aam, uMoonR - aam, ang) * uMoonA;
      vec3 skyC = sky0 + exp(-max(ang - uMoonR, 0.0) / 0.20) * 0.17 * uMoonA * VERM;
      vec3 moonC = VERM * (1.02 - 0.07 * pow(ang / uMoonR, 3.0)) + (hash(floor(uv * vec2(3000.0, 1500.0))) - 0.5) * 0.012;
      skyC = mix(skyC, moonC, disc);
      // stone, graded to night
      float Lu = dot(day, vec3(0.2126, 0.7152, 0.0722)), Lg = pow(clamp((Lu - 0.10) / 0.90, 0.0, 1.0), 1.55);
      vec3 stone = vec3(Lg * 1.05, Lg * 0.93, Lg * 0.80) * 0.9 + day * 0.1 * Lg;
      // the sweep: drawing -> points -> stone, from left to right like on the cover
      float r = (u - 0.5) * 360.0 / uSpan + 0.5 + uShift;
      float dens = pow(ss(0.10, 0.74, r), 1.7), g1 = ss(0.50, 0.70, r), g2 = ss(0.66, 0.86, r), ar = pow(ss(0.72, 1.0, r), 1.3);
      float wl = (1.0 - ss(0.16, 0.52, r)) * 0.92;
      float h1, h2;
      float p1 = cloud(vec2(u * uPts, th / PI * uPts * 0.5), sth, dens, g1, h1);
      float p2 = cloud(vec2(u * uPts * 1.41 + 0.37, th / PI * uPts * 0.705 + 0.61), sth, dens * 0.8, g1, h2);
      float pc = max(p1, p2);
      vec3 pcol = clamp(stone * (0.78 + 0.5 * mix(h1, h2, step(p1, p2))) + 0.045, 0.0, 1.0);
      vec3 tem = sky0;
      float drawn = 1.0 - ss(uDraw - 10.0, uDraw, el);
      tem = mix(tem, LINE * (1.0 + 0.6 * ss(uDraw - 10.0, uDraw, el)), clamp(ax.r * 1.25, 0.0, 1.0) * wl * drawn);
      tem = mix(tem, mix(pcol, stone, g2), clamp(pc + g2, 0.0, 1.0) * (1.0 - ar));
      tem = mix(tem, stone, ar);
      // ground: the night stone, dimmed, fading to navy below
      vec3 gro = mix(stone * 0.62, NAVY * 0.45, ss(-2.0, -38.0, el));
      vec3 col = mix(gro, tem, ax.b);
      col = mix(col, skyC, ax.g);
      col += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * 0.028;   // film grain
      gl_FragColor = vec4(col, 1.0 - uDay);
    }`,
});
const introGeo = new THREE.SphereGeometry(90, 128, 64); introGeo.scale(-1, 1, 1);
const introMesh = new THREE.Mesh(introGeo, introMat); introMesh.renderOrder = -5; introMesh.frustumCulled = false; panoGroup.add(introMesh);
const ease = { io3: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, o3: (t) => 1 - Math.pow(1 - t, 3),
  ios: (t) => -(Math.cos(Math.PI * t) - 1) / 2, o5: (t) => 1 - Math.pow(1 - t, 5) };
function tween(ms, fn, ez = ease.io3, delay = 0) {
  return new Promise((res) => { const t0 = performance.now() + delay;
    const step = (now) => { const k = Math.min(1, Math.max(0, (now - t0) / ms)); fn(ez(k), k); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step); });
}
const lerp = THREE.MathUtils.lerp, D2R = THREE.MathUtils.degToRad;
function heroTarget() {                                    // the cover's view: looking east, steeply up
  const a = innerWidth / innerHeight;
  if (a < 1) return { pitch: 42, fov: Math.min(108, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(D2R(44)) / a))) };
  const q = location.search, hp = q.match(/hp=([\d.]+)/), hf = q.match(/hf=([\d.]+)/);   // (test overrides)
  return { pitch: hp ? +hp[1] : 50, fov: hf ? +hf[1] : (a > 1.9 ? 72 : 78) };
}
function elevDir(elDeg) { const e = D2R(elDeg); return new THREE.Vector3(-Math.cos(e), Math.sin(e), 0); }
const projCam = new THREE.PerspectiveCamera();
function screenY(elDeg, tg) {
  projCam.fov = tg.fov; projCam.aspect = innerWidth / innerHeight; projCam.near = 0.1; projCam.far = 200;
  projCam.rotation.order = 'YXZ'; projCam.rotation.set(D2R(tg.pitch), Math.PI / 2, 0); projCam.updateMatrixWorld(); projCam.updateProjectionMatrix();
  const p = elevDir(elDeg).multiplyScalar(50).project(projCam); return (1 - p.y) / 2 * innerHeight;
}
const MOON_EL = 57, APEX_EL = 58.9;                                        // centre a little under the ridge, as on the cover: the roof hides its lower half
function layoutHero() {
  const W = innerWidth, H = innerHeight, portrait = W / H < 1, tg = heroTarget();
  const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || Math.max(18, Math.min(56, W * 0.036));
  const nm = $('h-name'), box = document.querySelector('.h-title');
  const tw = portrait ? W - 2 * pad : Math.min(W * 0.6, H * 1.08);
  introU.uMoonR.value = D2R(portrait ? 15.5 : 11.5);
  box.style.left = ((W - tw) / 2) + 'px'; box.style.right = 'auto'; box.style.width = tw + 'px';
  nm.style.display = 'inline-block'; nm.style.fontSize = '100px';
  const w100 = nm.getBoundingClientRect().width; nm.style.fontSize = (100 * tw / Math.max(w100, 1)) + 'px';
  // as on the cover: the hairline crosses the moon, the two names sit between it and the ridge of the roof
  const yTop = screenY(MOON_EL + THREE.MathUtils.radToDeg(introU.uMoonR.value), tg), yApex = screenY(APEX_EL, tg);
  const rule = box.querySelector('.h-rule'), sub = box.querySelector('.h-sub');
  const want = Math.min(yTop + (yApex - yTop) * 0.5, yApex - sub.offsetHeight - 0.9 * parseFloat(getComputedStyle(rule).marginBottom) - 14) - rule.offsetTop;
  box.style.top = Math.max(H * (portrait ? 0.16 : 0.13), want) + 'px';
}
window.__layoutHero = layoutHero;
const placeOn = $('h-place-on'), _mv = new THREE.Vector3(), _mt = new THREE.Vector3();
function moonClip() {                                       // the place name turns cream where it crosses the moon
  camera.updateMatrixWorld();
  _mv.copy(introU.uMoonDir.value).multiplyScalar(50).applyEuler(panoGroup.rotation).add(camPos).project(camera);
  const e = HERO.moonEl + THREE.MathUtils.radToDeg(introU.uMoonR.value);
  _mt.copy(elevDir(e)).multiplyScalar(50).add(camPos).project(camera);
  const mx = (_mv.x + 1) / 2 * innerWidth, my = (1 - _mv.y) / 2 * innerHeight, mr = Math.abs(_mt.y - _mv.y) / 2 * innerHeight;
  const r = placeOn.getBoundingClientRect();
  placeOn.style.clipPath = HERO.moonA > 0.05 ? `circle(${mr.toFixed(1)}px at ${(mx - r.left).toFixed(1)}px ${(my - r.top).toFixed(1)}px)` : 'circle(0px at -999px -999px)';
}
function heroCam() { lookYaw = HERO.yaw; lookPitch = D2R(HERO.pitch); applyLook(); if (camera.fov !== HERO.fov) { camera.fov = HERO.fov; camera.updateProjectionMatrix(); } }
const par = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => { par.tx = e.clientX / innerWidth - 0.5; par.ty = e.clientY / innerHeight - 0.5; });
function heroTick(dt) {
  if (!HERO.active) return;
  const t = (performance.now() - HERO.t0) / 1000;
  par.x += (par.tx - par.x) * Math.min(1, dt * 1.6); par.y += (par.ty - par.y) * Math.min(1, dt * 1.6);
  const drift = HERO.leaving ? 0 : 1;
  HERO.yaw = HERO.baseYaw + drift * (0.010 * Math.sin(t * 0.11) - par.x * 0.035);
  if (!HERO.leaving) HERO.pitch = HERO.basePitch + 0.6 * Math.sin(t * 0.13) + par.y * 1.6;
  introU.uDraw.value = HERO.draw; introU.uShift.value = HERO.shift; introU.uDay.value = HERO.day; introU.uMoonA.value = HERO.moonA; introU.uTime.value = t;
  introU.uMoonDir.value.copy(elevDir(HERO.moonEl));
  heroCam(); moonClip();
}
let heroReady = false;
async function loadIntro() {
  const tl = new THREE.TextureLoader();
  const aux = (HI_RES && renderer.capabilities.maxTextureSize >= 8192) ? 'img/intro_Court_W_8k.png' : 'img/intro_Court_W_4k.png';
  const [a, p] = await Promise.all([tl.loadAsync(aux), tl.loadAsync(panoById.Court_W.image_phone)]);
  for (const t of [a, p]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; }
  introU.uAux.value = a; introU.uPano.value = p;
}
async function playHeroIn() {
  const tg = heroTarget(); HERO.basePitch = tg.pitch; HERO.baseYaw = 0;
  HERO.fov = tg.fov + 9; HERO.pitch = tg.pitch - 9; HERO.t0 = performance.now();
  layoutHero();
  $('loader').classList.add('done');
  requestAnimationFrame(() => $('hero').classList.replace('pre', 'in'));
  tween(5600, (k) => { HERO.fov = lerp(tg.fov + 9, tg.fov, k); HERO.basePitch = lerp(tg.pitch - 9, tg.pitch, k); }, ease.o3);
  tween(2600, (k) => { HERO.draw = lerp(-20, 95, k); }, ease.ios);
  tween(2200, (k) => { HERO.moonA = k; }, ease.ios, 900);
  tween(5200, (k) => { HERO.moonEl = lerp(MOON_EL - 9, MOON_EL, k); }, ease.o3);
  await tween(4300, (k) => { HERO.shift = lerp(-1.25, 0, k); }, ease.io3, 1300);
  heroReady = true;
}
let leaving = null;
function enterTemple() {
  if (!HERO.active || leaving) return leaving;
  HERO.leaving = true; const p0 = HERO.pitch, f0 = HERO.fov, y0 = HERO.yaw, s0 = HERO.shift, m0 = HERO.moonEl, a0 = HERO.moonA;
  $('hero').classList.add('out');
  leaving = (async () => {
    tween(2700, (k) => { HERO.shift = lerp(s0, 1.4, k); }, ease.io3);
    tween(1900, (k) => { HERO.moonA = lerp(a0, 0, k); HERO.moonEl = lerp(m0, m0 - 7, k); }, ease.ios, 700);
    tween(2100, (k) => { HERO.day = k; }, ease.ios, 2000);
    setTimeout(() => { $('hud').classList.remove('hidden'); $('hud').classList.add('fadein'); }, 4300);
    await tween(3300, (k) => { HERO.pitch = lerp(p0, 0, k); HERO.fov = lerp(f0, 75, k); HERO.yaw = lerp(y0, 0, k); }, ease.io3, 1700);
    finishHero();
  })();
  return leaving;
}
function finishHero() {
  HERO.active = false; HERO.day = 1; introMesh.visible = false; markerGroup.visible = true;
  for (const m of markers) m.material.opacity = 0;
  tween(900, (k) => { for (const m of markers) m.material.opacity = k; }, ease.ios, 150);
  document.body.classList.remove('is-hero'); $('hero').classList.add('gone'); $('loader').classList.add('done'); $('btn-home').classList.remove('hidden');
  $('hud').classList.remove('hidden');
  camera.fov = 75; camera.updateProjectionMatrix(); lookYaw = 0; lookPitch = 0; applyLook(); drawMini();
}
// any scroll, swipe, click or key on the start page enters the temple
renderer.domElement.addEventListener('wheel', (e) => { if (HERO.active && e.deltaY > 4) enterTemple(); }, { passive: true });
addEventListener('wheel', (e) => { if (HERO.active && e.deltaY > 4) enterTemple(); }, { passive: true });
addEventListener('keydown', (e) => { if (HERO.active && ['Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); enterTemple(); } });
$('btn-enter').onclick = () => enterTemple(); $('h-scroll').onclick = () => enterTemple();
addEventListener('resize', () => { if (HERO.active && !HERO.leaving) { const tg = heroTarget(); HERO.basePitch = tg.pitch; HERO.fov = tg.fov; layoutHero(); } });

function setMap(open) {
  $('mapbox').classList.toggle('closed', !open); $('hud').classList.toggle('map-open', open);
  if (open) { miniHover = null; drawMini(); }
}
$('btn-map').onclick = () => setMap(true); $('btn-map-x').onclick = () => setMap(false);
addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !HERO.active && !current) setMap($('mapbox').classList.contains('closed')); });
// back to the start page (the cover): plays the opening again
async function goHome() {
  if (HERO.active) return;
  $('btn-home').classList.add('hidden');
  await fadeTo(1, 380);
  if (current) {                                            // leave the studio without its own fade
    studio.visible = false; panoGroup.visible = true; scene.background = null; scene.environment = null;
    if (orbit) orbit.enabled = false; camera.position.set(0, 0, 0); setViewOffset(false);
    document.body.classList.remove('studio', 'info-open'); $('studio-ui').classList.add('hidden'); current = null;
  }
  if (!currentPano || currentPano.id !== 'Court_W') await goPano('Court_W', { fade: false });
  setMap(false); $('hud').classList.add('hidden'); $('hud').classList.remove('fadein');
  Object.assign(HERO, { active: true, leaving: false, shift: -1.25, day: 0, moonA: 0, moonEl: MOON_EL - 9, draw: -20 });
  leaving = null; introMesh.visible = true; markerGroup.visible = false;
  const hero = $('hero'); hero.className = 'pre'; document.body.classList.add('is-hero');
  void hero.offsetWidth;
  if (!introU.uAux.value) await loadIntro();
  playHeroIn(); heroTick(0);
  await fadeTo(0, 700);
}
$('btn-home').onclick = goHome;
let started = false;
async function start() {                                    // used by Enter VR and deep links: skip the start page
  if (started) return; started = true;
  if (HERO.active) finishHero();
}
markerGroup.visible = false;
{
  const lf = $('l-fill'); let n = 0;
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => { n = Math.max(n, loaded / total); lf.style.width = (100 * n) + '%'; };
  $('load-status').textContent = T('preparing');
}
const deep = /start|obj=|pano=/.test(location.hash);
await Promise.all([goPano('Court_W', { fade: false }), deep ? null : loadIntro()]);
readyShown = true;
if (deep) { finishHero(); started = true; }
else { await document.fonts.ready.catch(() => {}); applyLang(); await new Promise((r) => setTimeout(r, 350)); playHeroIn(); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// offline: fetch every asset this device needs, so the service worker keeps it
$('btn-offline').onclick = async () => {
  const st = $('offline-status');
  if (!('serviceWorker' in navigator)) { st.textContent = T('offNo'); return; }
  await navigator.serviceWorker.ready;
  const list = await fetch('data/files.json').then((r) => r.json());
  const urls = list.core.concat(list.models, HI_RES ? list.panos8k : list.panos4k);
  let n = 0;
  for (const u of urls) { await fetch(u).catch(() => {}); st.textContent = `${T('offSaving')} ${++n} / ${urls.length}`; }
  st.textContent = T('offDone').replace('{n}', urls.length);
};
window.__AT = { goPano, openObject, closeObject, PANOS, OBJECTS };   // for testing
// deep links for testing / presenting: #pano=Cella  #obj=statue  #start
{
  const h = location.hash; const pm = h.match(/pano=(\w+)/), om = h.match(/obj=(\w+)/);
  if (pm) await goPano(pm[1], { fade: false });
  if (om) await openObject(om[1]);
}
