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
const FIT_SIZE = 1.35;             // studio: largest dimension when fitted (m)

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
const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const sphere = new THREE.Mesh(sphereGeo, sphereMat); sphere.renderOrder = -10; panoGroup.add(sphere);
const tiles = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
  const g = new THREE.SphereGeometry(100, 64, 32, c * Math.PI, Math.PI, r * Math.PI / 2, Math.PI / 2); g.scale(-1, 1, 1);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000 })); m.renderOrder = -10; m.visible = false;
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
  g.fillStyle = '#d6aa54'; g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.fill();
  return canvasTex(c);
}
const MARKER_TEX = markerTexture();
function labelSprite(title, sub) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 220; const g = c.getContext('2d');
  g.font = `500 64px ${FONT}`; const w1 = g.measureText(title).width;
  g.font = `400 40px ${FONT}`; const w2 = g.measureText(sub || '').width;
  const w = Math.min(1000, Math.max(w1, w2) + 70);
  g.fillStyle = 'rgba(12,12,16,0.82)'; roundRect(g, (1024 - w) / 2, 10, w, sub ? 190 : 110, 26); g.fill();
  g.fillStyle = '#ece6da'; g.textAlign = 'center'; g.font = `500 64px ${FONT}`; g.fillText(title, 512, 88);
  if (sub) { g.fillStyle = '#d6aa54'; g.font = `400 40px ${FONT}`; g.fillText(sub, 512, 160); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), depthTest: false, transparent: true }));
  s.scale.set(6.4, 6.4 * 220 / 1024, 1); s.renderOrder = 12; s.visible = false;
  return s;
}
let markers = [];
function buildMarkers(p) {
  markerGroup.clear(); markers = [];
  for (const h of p.hotspots) {
    const o = objById[h.object]; if (!o) continue;
    const dir = dirFromUV(h.u, h.v);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARKER_TEX, depthTest: false, transparent: true }));
    s.position.copy(dir).multiplyScalar(MARKER_R); s.scale.setScalar(1.1); s.renderOrder = 11;
    s.userData = { obj: o.id, base: 1.1 };
    const lab = labelSprite(o.title, o.sub);
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
let currentPano = null;
function faceHeading(deg) {                  // turn the view to a world azimuth (east = 0, north = 90)
  const want = THREE.MathUtils.degToRad(deg) + Math.PI / 2;           // camera yaw (three) that looks along that azimuth
  if (renderer.xr.isPresenting) {
    const d = new THREE.Vector3(); renderer.xr.getCamera().getWorldDirection(d);
    const have = Math.atan2(-d.x, -d.z); rig.rotation.y += want - have;
  } else { lookYaw = THREE.MathUtils.degToRad(deg); lookPitch = 0; applyLook(); }
}
async function goPano(id, { fade = true } = {}) {
  const p = panoById[id]; if (!p) return;
  showLoading('Loading ' + p.title);
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
  currentPano = p; buildMarkers(p); drawPlans(); $('where-name').textContent = p.title;
  faceHeading(p.heading_deg || 0);
  hideLoading();
  if (fade) await fadeTo(0, 320);
  // pre-load the neighbours quietly
  for (const q of PANOS.panoramas) if (q.id !== id) for (const u of panoUrls(q)) fetch(u).catch(() => {});
}

// ------------------------------------------------------------------ plans (2D overlay + VR floor)
const planImg = new Image(); planImg.src = 'img/plan.png';
await planImg.decode().catch(() => {});
const planCv = document.createElement('canvas'); planCv.width = planImg.naturalWidth || 2304; planCv.height = planImg.naturalHeight || 1272;
const planTex = canvasTex(planCv);
function w2p(X, Y, W, H) { return [(X - PLAN.x0) / (PLAN.x1 - PLAN.x0) * W, (PLAN.y1 - Y) / (PLAN.y1 - PLAN.y0) * H]; }
function drawPlanOn(ctx, W, H, opts = {}) {
  ctx.clearRect(0, 0, W, H); ctx.drawImage(planImg, 0, 0, W, H);
  const k = W / 2304;
  for (const p of PANOS.panoramas) {
    const [x, y] = w2p(p.eye_m[0], p.eye_m[1], W, H); const cur = currentPano && p.id === currentPano.id;
    if (cur && opts.yaw !== undefined) {                         // view cone
      ctx.fillStyle = 'rgba(214,170,84,0.35)'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, 150 * k, -opts.yaw - 0.55, -opts.yaw + 0.55); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = cur ? '#b8402c' : '#d6aa54'; ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * k;
    ctx.beginPath(); ctx.arc(x, y, (cur ? 30 : 24) * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (opts.labels) {
      ctx.font = `500 ${46 * k}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = cur ? '#ffffff' : '#ece6da';
      ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 10 * k; const ty = y + (p.eye_m[1] > 20 ? -50 : 80) * k;
      ctx.strokeText(p.title, x, ty); ctx.fillText(cur ? p.title + ' (here)' : p.title, x, ty);
    }
  }
}
const mini = $('minimap'); const miniCtx = mini.getContext('2d');
function camYawWorld() {                     // world azimuth of the view (east = 0, north = +90 deg)
  const d = new THREE.Vector3(); (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldDirection(d);
  return Math.atan2(d.z, -d.x);              // three (x,z) = (-dX, dY)
}
function drawPlans() {
  drawPlanOn(planCv.getContext('2d'), planCv.width, planCv.height, { labels: true }); planTex.needsUpdate = true;
  drawMini();
}
function drawMini() { if ($('hud').classList.contains('hidden')) return; drawPlanOn(miniCtx, mini.width, mini.height, { yaw: camYawWorld(), labels: false }); }
mini.addEventListener('click', (e) => {
  const r = mini.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const X = PLAN.x0 + fx * (PLAN.x1 - PLAN.x0), Y = PLAN.y1 - fy * (PLAN.y1 - PLAN.y0);
  const best = nearestPano(X, Y); if (best && best.id !== currentPano.id) goPano(best.id);
});
function nearestPano(X, Y, maxD = 6) {
  let best = null, bd = maxD;
  for (const p of PANOS.panoramas) { const d = Math.hypot(p.eye_m[0] - X, p.eye_m[1] - Y); if (d < bd) { bd = d; best = p; } }
  return best;
}
// VR floor plan: world (X east, Y north) -> three (x, z) = (-(X-ex), (Y-ey)) * scale, under the user
const floorPlan = new THREE.Mesh(new THREE.BufferGeometry(),
  new THREE.MeshBasicMaterial({ map: planTex, transparent: true, opacity: 0.92, depthTest: false, side: THREE.DoubleSide }));
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
  const g = await gltf.loadAsync(o.glb, (e) => { if (e.total) showLoading(`Loading ${o.title} ${Math.round(100 * e.loaded / e.total)}%`); });
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
let current = null;            // { o, rec, real:boolean }
let orbit = null;
function placeStudio() {
  const { rec } = current; const real = current.real;
  const scale = real ? 1 : FIT_SIZE / rec.maxDim;
  current.baseScale = scale; pivot.scale.setScalar(scale * zoom);
  const h = rec.size.y * scale, R = rec.maxDim * scale / 2;
  const lift = real ? Math.max(0.35, 0.0) : 0;
  const cy = real ? lift + h / 2 : Math.max(1.35, h / 2 + 0.35);
  const dist = real ? Math.max(2.6, R * 1.7 + 1.0) : 1.55;
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
  if (orbit) {
    orbit.target.copy(holder.position);
    const camDist = real ? Math.max(R * 2.6, 3) : Math.max(0.9, R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12);
    camera.position.set(holder.position.x, holder.position.y + (real ? 0 : 0.15), holder.position.z + camDist);
    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    orbit.minDistance = R * 0.5; orbit.maxDistance = R * 8 + 3; orbit.update();
  }
  positionPanel();
}
async function openObject(id) {
  const o = objById[id]; if (!o) return;
  showLoading('Loading ' + o.title);
  let rec; try { rec = await loadModel(o); } catch (e) { hideLoading(); console.error(e); return; }
  await fadeTo(1, 250);
  pivot.clear(); pivot.add(rec.root); pivot.quaternion.identity(); spinIdle = true; zoom = 1;
  current = { o, rec, real: false };
  panoGroup.visible = false; floorPlan.visible = false; studio.visible = true;
  scene.background = STUDIO_BG; scene.environment = envTex; scene.environmentIntensity = 0.28;
  if (!renderer.xr.isPresenting) {
    orbit = orbit || new OrbitControls(camera, renderer.domElement);
    orbit.enabled = true; orbit.enableDamping = true; orbit.enablePan = false;
    orbit.addEventListener('start', () => { spinIdle = false; });
    $('hud').classList.add('hidden'); $('studio-ui').classList.remove('hidden'); fillPanelHTML(o); setViewOffset(true);
  }
  drawVRPanel(); placeStudio(); hideLoading();
  await fadeTo(0, 350);
}
async function closeObject() {
  await fadeTo(1, 220);
  studio.visible = false; panoGroup.visible = true; scene.background = null; scene.environment = null;
  if (orbit) { orbit.enabled = false; }
  if (!renderer.xr.isPresenting) {
    camera.position.set(0, 0, 0); applyLook(); setViewOffset(false);
    $('studio-ui').classList.add('hidden'); $('hud').classList.remove('hidden');
  } else { layoutFloorPlan(); floorPlan.visible = true; }
  current = null; vrPanel.visible = false;
  await fadeTo(0, 320);
}
function toggleReal() { if (!current) return; current.real = !current.real; placeStudio(); updateScaleLabels(); }
function resetStudio() { if (!current) return; pivot.quaternion.identity(); zoom = 1; placeStudio(); }
function updateScaleLabels() { $('btn-scale').textContent = current && current.real ? 'Fit to view' : 'Real size'; drawVRPanel(); }
function sizeText(o) { const [x, y, z] = o.size_m; return `${x.toFixed(2)} × ${z.toFixed(2)} m, ${y.toFixed(2)} m high`; }
function fillPanelHTML(o) {
  $('p-sub').textContent = o.sub; $('p-title').textContent = o.title; $('p-text').textContent = o.text;
  $('p-size').textContent = sizeText(o); $('p-ev').textContent = o.ev; $('p-src').textContent = o.src;
  const img = $('p-img'); if (o.image) { img.src = o.image; img.classList.remove('hidden'); } else img.classList.add('hidden');
  updateScaleLabels();
}
$('btn-back').onclick = closeObject; $('btn-scale').onclick = toggleReal; $('btn-reset').onclick = resetStudio;

// VR info panel (canvas texture) with three buttons
const PW = 1024, PH = 1400;
const panelCv = document.createElement('canvas'); panelCv.width = PW; panelCv.height = PH;
const panelTex = canvasTex(panelCv);
const vrPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78 * PH / PW),
  new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, depthTest: true }));
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
  g.strokeStyle = 'rgba(214,170,84,0.45)'; g.lineWidth = 3; roundRect(g, 2, 2, PW - 4, PH - 4, 34); g.stroke();
  let y = 92; g.textAlign = 'left';
  g.fillStyle = '#d6aa54'; g.font = `500 30px ${FONT}`; g.fillText(o.sub.toUpperCase(), 60, y); y += 70;
  g.fillStyle = '#ece6da'; g.font = `300 62px ${FONT}`; y = wrapText(g, o.title, 60, y, PW - 120, 70) + 10;
  if (o.image) { const im = getImg(o.image); if (im.complete && im.naturalWidth) { const h = (PW - 120) * im.naturalHeight / im.naturalWidth; g.drawImage(im, 60, y, PW - 120, h); y += h + 30; } }
  g.fillStyle = '#ddd6c8'; g.font = `400 32px ${FONT}`; y = wrapText(g, o.text, 60, y + 10, PW - 120, 44) + 16;
  g.font = `400 26px ${FONT}`;
  for (const [k, v] of [['SIZE', sizeText(o)], ['EVIDENCE', o.ev], ['SOURCE', o.src]]) {
    g.fillStyle = '#d6aa54'; g.fillText(k, 60, y); g.fillStyle = '#a39c8f'; y = wrapText(g, v, 230, y, PW - 290, 36) + 8;
  }
  const labels = ['Back to the temple', current.real ? 'Fit to view' : 'Real size', 'Reset'];
  const ws = [380, 260, 180]; let x = 60; const by = PH - 140; panelButtons = [];
  labels.forEach((t, i) => {
    g.fillStyle = i === 0 ? (hover === 0 ? '#e9c272' : '#d6aa54') : (hover === i ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)');
    roundRect(g, x, by, ws[i], 90, 45); g.fill();
    g.strokeStyle = 'rgba(236,230,218,0.35)'; g.lineWidth = 2; if (i) g.stroke();
    g.fillStyle = i === 0 ? '#16120a' : '#ece6da'; g.font = `600 32px ${FONT}`; g.textAlign = 'center'; g.fillText(t, x + ws[i] / 2, by + 56); g.textAlign = 'left';
    panelButtons.push({ x0: x / PW, x1: (x + ws[i]) / PW, y0: 1 - (by + 90) / PH, y1: 1 - by / PH, act: [closeObject, toggleReal, resetStudio][i] });
    x += ws[i] + 22;
  });
  g.fillStyle = '#7d776c'; g.font = `400 24px ${FONT}`;
  g.fillText('Trigger + twist: turn · thumbstick: turn, zoom · grip: back', 60, PH - 24);
  panelTex.needsUpdate = true;
}
function positionPanel() {
  if (!renderer.xr.isPresenting || !current) { vrPanel.visible = false; return; }
  const head = new THREE.Vector3(); renderer.xr.getCamera().getWorldPosition(head);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(holder.quaternion);
  const toView = new THREE.Vector3(0, 0, 1).applyQuaternion(holder.quaternion);
  const R = current.real ? 0 : FIT_SIZE / 2;
  const base = current.real ? head.clone().add(toView.clone().multiplyScalar(-0.9)) : holder.position.clone();
  vrPanel.position.copy(base).add(right.multiplyScalar(R + 0.62)); vrPanel.position.y = head.y - 0.1;
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
  if (current) return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    camera.fov = THREE.MathUtils.clamp(camera.fov * ptr.pinch / d, 30, 95); camera.updateProjectionMatrix(); ptr.pinch = d; ptr.moved = 99; return;
  }
  if (!ptr.down) { hoverPick(e); return; }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.abs(dx) + Math.abs(dy);
  const k = camera.fov / innerHeight * Math.PI / 180;
  lookYaw += dx * k; lookPitch = THREE.MathUtils.clamp(lookPitch + dy * k, -1.45, 1.45); applyLook();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId); ptr.down = pointers.size > 0;
  if (!current && ptr.moved < 6) clickPick(e);
});
renderer.domElement.addEventListener('wheel', (e) => {
  if (current) return; camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 30, 95); camera.updateProjectionMatrix();
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
function setViewOffset(on) {
  if (on && !renderer.xr.isPresenting) {
    const W = innerWidth, H = innerHeight;
    if (W > 760) camera.setViewOffset(W, H, Math.min(420, W) / 2, 0, W, H); else camera.setViewOffset(W, H, 0, H * 0.23, W, H);
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
  c.addEventListener('connected', (e) => { c.userData.gamepad = e.data.gamepad; c.userData.hand = !!e.data.hand; });
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
      if (Math.abs(ay) > 0.15) { zoom = THREE.MathUtils.clamp(zoom * (1 - ay * dt * 1.2), 0.3, 4); pivot.scale.setScalar(current.baseScale * zoom); }
    }
  }
  if (!current) setHover(anyMarker);
  if (current && ph !== panelHover) { panelHover = ph; drawVRPanel(ph); }
}
const xrBtn = $('btn-vr');
const SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] };
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    xrBtn.disabled = !ok; xrBtn.textContent = ok ? 'Enter VR' : 'VR not available on this device';
  }).catch(() => { xrBtn.textContent = 'VR not available'; });
} else { xrBtn.textContent = 'VR needs a headset browser (https)'; }
xrBtn.onclick = async () => {
  const s = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
  await start(); renderer.xr.setSession(s);
};
renderer.xr.addEventListener('sessionstart', () => {
  scene.remove(camera); rig.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); camera.clearViewOffset(); camera.fov = 75; camera.updateProjectionMatrix();
  $('hud').classList.add('hidden'); $('studio-ui').classList.add('hidden');
  if (orbit) orbit.enabled = false;
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
  if (current) {
    if (spinIdle) pivot.rotateY(dt * 0.18);
    if (orbit && orbit.enabled) orbit.update();
    if (xr && frame % 30 === 0 && !controllers.some((c) => c.userData.drag)) positionPanel();
  } else if (!xr && (frame++ % 6 === 0)) drawMini();
  frame++;
  renderer.render(scene, camera);
});

// ------------------------------------------------------------------ start
let started = false;
async function start() {
  if (started) return; started = true;
  $('intro').classList.add('hidden'); $('hud').classList.remove('hidden');
  applyLook();
}
$('btn-2d').onclick = () => start();
await goPano('Court_W', { fade: false });
$('load-status').textContent = HI_RES ? 'Ready · 8K panoramas' : 'Ready · 4K panoramas';
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// offline: fetch every asset this device needs, so the service worker keeps it
$('btn-offline').onclick = async () => {
  const st = $('offline-status');
  if (!('serviceWorker' in navigator)) { st.textContent = 'Offline use is not supported in this browser.'; return; }
  await navigator.serviceWorker.ready;
  const list = await fetch('data/files.json').then((r) => r.json());
  const urls = list.core.concat(list.models, HI_RES ? list.panos8k : list.panos4k);
  let n = 0;
  for (const u of urls) { await fetch(u).catch(() => {}); st.textContent = `Saving ${++n} / ${urls.length}`; }
  st.textContent = `Saved: ${urls.length} files. The page now works without internet in this browser.`;
};
window.__AT = { goPano, openObject, closeObject, PANOS, OBJECTS };   // for testing
// deep links for testing / presenting: #pano=Cella  #obj=statue  #start
{
  const h = location.hash; const pm = h.match(/pano=(\w+)/), om = h.match(/obj=(\w+)/);
  if (/start|obj=|pano=/.test(h)) await start();
  if (pm) await goPano(pm[1], { fade: false });
  if (om) await openObject(om[1]);
}
