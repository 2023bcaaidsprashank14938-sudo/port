import * as THREE from 'three';
import './style.css';
import { profile, sections } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const { clamp, lerp, euclideanModulo } = THREE.MathUtils;
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORLD = 26, COLLIDE = 3.6, ZONE_R = 3.2;

/* ---------- Panel / fallback HTML (built from data.js) ---------- */
function sectionHTML(s) {
  let body = (s.paragraphs || []).map((p) => `<p>${p}</p>`).join('');
  if (s.facts) body += `<dl class="facts">${s.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (s.projects) body += `<div class="cards">${s.projects.map((p, i) => `
    <article class="card"><span class="num">0${i + 1}</span><h3>${p.title}</h3><p>${p.desc}</p>
    <div class="tags">${p.tags.map((t) => `<span>${t}</span>`).join('')}</div>
    ${p.link ? `<a class="link" href="${p.link}" target="_blank" rel="noopener noreferrer">View project ↗</a>` : ''}</article>`).join('')}</div>`;
  if (s.groups) body += s.groups.map((g) => `<h3 class="group">${g.name}</h3><div class="tags big">${g.items.map((i) => `<span>${i}</span>`).join('')}</div>`).join('');
  if (s.id === 'contact') {
    const links = [
      ['Email', profile.email, `mailto:${profile.email}`],
      ['Call', profile.phone, `tel:${profile.phone}`],
      ['LinkedIn', 'Connect with me', profile.linkedin, true],
      profile.github && ['GitHub', 'See my code', profile.github, true],
      profile.resume && ['Resume', 'Download PDF', profile.resume, true]
    ].filter(Boolean);
    body += `<div class="contact">${links.map(([l, sub, href, ext]) => `<a class="contact-card" href="${href}" ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''}><strong>${l} ↗</strong><span>${sub}</span></a>`).join('')}</div>
      <button class="btn ghost" data-copy="${profile.email}">Copy email address</button>`;
  }
  return `<p class="kicker">${s.kicker}</p><h2>${s.title}</h2>${body}`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy email address'), 1800); });
});

/* ---------- Renderer (with WebGL fallback) ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  const fb = $('#fallback');
  fb.hidden = false;
  fb.innerHTML = `<h1>${profile.name}</h1><p>${profile.role}</p>` + sections.map((s) => `<section style="--accent:${s.color}">${sectionHTML(s)}</section>`).join('');
  document.body.classList.add('no-webgl');
}
if (renderer) init(renderer);

function init(renderer) {
  const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));

  /* ---------- Scene, camera, renderer ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog('#000', 35, 105);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 200);
  camera.position.set(30, 16, 30);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  $('#app').appendChild(renderer.domElement);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------- Themes (day ↔ night) ---------- */
  const C = (h) => new THREE.Color(h);
  const P = {
    day: { sky: C('#bfe6ff'), ground: C('#7fd16f'), sun: 2.8, sunC: C('#ffffff'), hemi: 1.6, hemiG: C('#719b62'), win: 0, lamp: 0.2, glow: 0, fire: 0, tree: C('#2e9e5b') },
    night: { sky: C('#0a0f24'), ground: C('#14243d'), sun: 0.5, sunC: C('#8fa8ff'), hemi: 0.9, hemiG: C('#16223a'), win: 1.4, lamp: 2.2, glow: 0.55, fire: 1, tree: C('#1b6a55') }
  };
  let themeT = 1, themeTarget = 1;

  const sun = new THREE.DirectionalLight('#fff', 3);
  sun.position.set(15, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 80 });
  scene.add(sun);
  const hemi = new THREE.HemisphereLight('#ffffff', '#719b62', 1);
  scene.add(hemi);

  const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(WORLD * 2 + 4, 1, WORLD * 2 + 4), groundMat);
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(WORLD * 2 + 4, WORLD + 2, '#4a78c2', '#4a78c2');
  grid.position.y = 0.02;
  grid.material.transparent = true;
  scene.add(grid);

  /* ---------- Roads ---------- */
  const roadMat = new THREE.MeshStandardMaterial({ color: '#232838', roughness: 0.9 });
  const road1 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, WORLD * 2), roadMat);
  const road2 = new THREE.Mesh(new THREE.BoxGeometry(WORLD * 2, 0.07, 6), roadMat);
  road1.position.y = 0.03; road2.position.y = 0.035;
  road1.receiveShadow = road2.receiveShadow = true;
  scene.add(road1, road2);
  const dashGeo = new THREE.BoxGeometry(0.15, 0.03, 1.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: '#e8ecff' });
  for (let v = -24; v <= 24; v += 4) {
    if (Math.abs(v) < 3.5) continue;
    const a = new THREE.Mesh(dashGeo, dashMat); a.position.set(0, 0.09, v);
    const b = new THREE.Mesh(dashGeo, dashMat); b.position.set(v, 0.09, 0); b.rotation.y = Math.PI / 2;
    scene.add(a, b);
  }

  /* ---------- Buildings ---------- */
  const windowMats = [];
  const bodies = [];
  const floaters = [];
  const baseWindows = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.7) { g.fillStyle = `rgba(255,226,160,${0.55 + Math.random() * 0.45})`; g.fillRect(k * 16 + 3, r * 16 + 4, 10, 9); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    return t;
  })();

  function makeSign(text, color) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    const draw = () => {
      g.clearRect(0, 0, 1024, 256);
      g.fillStyle = '#0b1020'; g.beginPath(); g.roundRect(8, 8, 1008, 240, 40); g.fill();
      g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 24; g.stroke();
      g.fillStyle = '#fff'; g.font = '700 120px "Space Grotesk", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 512, 134); tex.needsUpdate = true;
    };
    draw();
    document.fonts?.load('700 120px "Space Grotesk"').then(draw);
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  }

  const iconGeo = { icosa: new THREE.IcosahedronGeometry(0.8), cube: new THREE.BoxGeometry(1.1, 1.1, 1.1), octa: new THREE.OctahedronGeometry(0.95), torus: new THREE.TorusGeometry(0.7, 0.26, 12, 32) };

  sections.forEach((s) => {
    const g = new THREE.Group();
    const accent = C(s.color);
    const rows = Math.round(s.height / 1.1);
    const tex = baseWindows.clone(); tex.needsUpdate = true; tex.repeat.set(1, rows / 8);
    const mat = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.5), roughness: 0.55, metalness: 0.15, emissive: '#ffe3a8', emissiveMap: tex, emissiveIntensity: 0 });
    windowMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, s.height, 3.6), mat);
    body.position.y = s.height / 2; body.castShadow = body.receiveShadow = true;
    body.userData.section = s; bodies.push(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#141a2c' }));
    roof.position.y = s.height + 0.15; roof.castShadow = true;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.08, 4.05), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }));
    edge.position.y = s.height + 0.34;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), makeSign(s.nav.toUpperCase(), s.color));
    sign.position.set(0, 1.9, 1.81);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(0.6), toneMapped: false }));
    door.position.set(0, 0.65, 1.81);
    g.add(body, roof, edge, sign, door);

    const icon = new THREE.Mesh(iconGeo[s.icon], new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, roughness: 0.3, flatShading: true }));
    icon.position.set(s.x, s.height + 1.9, s.z); icon.castShadow = true;
    floaters.push({ icon, base: s.height + 1.9 });
    scene.add(icon);

    g.position.set(s.x, 0, s.z);
    g.rotation.y = Math.atan2(-s.x, -s.z); // face the plaza
    scene.add(g);

    // interaction pad in front of the building
    const front = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    s.pad = new THREE.Vector3(s.x, 0, s.z).addScaledVector(front, 5.6);
    s.heading = g.rotation.y; // car faces the building
    const ringMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.9, toneMapped: false });
    s.ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.78, 48), ringMat);
    s.disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false }));
    s.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.4, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.ring.rotation.x = s.disc.rotation.x = -Math.PI / 2;
    s.ring.position.copy(s.pad).setY(0.1); s.disc.position.copy(s.pad).setY(0.09); s.beam.position.copy(s.pad).setY(7);
    scene.add(s.ring, s.disc, s.beam);
  });

  /* ---------- Trees & lamps ---------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const foliageMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2e' });
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 7);
  const coneGeo = new THREE.ConeGeometry(0.95, 1.6, 7);
  const placed = [];
  for (let n = 0; n < 300 && placed.length < 34; n++) {
    const x = (rnd() * 2 - 1) * (WORLD - 2), z = (rnd() * 2 - 1) * (WORLD - 2);
    if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;
    if (sections.some((s) => Math.hypot(x - s.x, z - s.z) < 6.5 || Math.hypot(x - s.pad.x, z - s.pad.z) < 4.5)) continue;
    if (placed.some(([a, b]) => Math.hypot(x - a, z - b) < 3)) continue;
    placed.push([x, z]);
    const k = 0.8 + rnd() * 0.7, t = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 0.6;
    const c1 = new THREE.Mesh(coneGeo, foliageMat); c1.position.y = 1.9;
    const c2 = new THREE.Mesh(coneGeo, foliageMat); c2.position.y = 2.8; c2.scale.setScalar(0.7);
    c1.castShadow = c2.castShadow = trunk.castShadow = true;
    t.add(trunk, c1, c2); t.scale.setScalar(k); t.position.set(x, 0, z); t.rotation.y = rnd() * 6;
    scene.add(t);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffcf8a' });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2a3047' });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3, 6), bulbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  for (const z of [-22, -14, -6, 6, 14, 22]) for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(side * 3.9, 1.5, z);
    const bulb = new THREE.Mesh(bulbGeo, lampMat); bulb.position.set(side * 3.9, 3.1, z);
    scene.add(pole, bulb);
  }

  /* ---------- Fireflies ---------- */
  const FN = 130, fBase = new Float32Array(FN * 3), fPos = new Float32Array(FN * 3);
  for (let i = 0; i < FN; i++) { fBase[i * 3] = (rnd() * 2 - 1) * WORLD; fBase[i * 3 + 1] = 0.6 + rnd() * 4; fBase[i * 3 + 2] = (rnd() * 2 - 1) * WORLD; }
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  const fMat = new THREE.PointsMaterial({ color: '#b8c8ff', size: 0.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(fGeo, fMat));

  /* ---------- Car ---------- */
  const car = new THREE.Group(), model = new THREE.Group();
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; model.add(m); return m; };
  const paint = new THREE.MeshStandardMaterial({ color: '#ff3d5a', roughness: 0.35, metalness: 0.4 });
  box(1.5, 0.45, 2.5, paint, 0, 0.62, 0);
  box(1.05, 0.5, 1.2, new THREE.MeshStandardMaterial({ color: '#9fdcff', roughness: 0.15, metalness: 0.5 }), 0, 1.1, 0.1);
  box(1.4, 0.07, 0.4, paint, 0, 1.05, 1.15);
  const lightOn = new THREE.MeshBasicMaterial({ color: '#fff6d0', toneMapped: false });
  const lightRed = new THREE.MeshBasicMaterial({ color: '#ff2040', toneMapped: false });
  for (const x of [-0.5, 0.5]) { box(0.28, 0.14, 0.06, lightOn, x, 0.68, -1.27); box(0.28, 0.14, 0.06, lightRed, x, 0.68, 1.27); }
  const wheels = [], wheelMat = new THREE.MeshStandardMaterial({ color: '#15171f' }), wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20);
  for (const x of [-0.8, 0.8]) for (const z of [-0.8, 0.8]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); w.castShadow = true; model.add(w); wheels.push(w);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: '#2ee6ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 3), glowMat); under.rotation.x = -Math.PI / 2; under.position.y = 0.06; car.add(under);
  // headlight beam on the ground
  const bc = document.createElement('canvas'); bc.width = 128; bc.height = 256;
  const bg = bc.getContext('2d'), grad = bg.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,240,200,0.9)'); grad.addColorStop(1, 'rgba(255,240,200,0)');
  bg.fillStyle = grad; bg.beginPath(); bg.moveTo(40, 256); bg.lineTo(88, 256); bg.lineTo(128, 0); bg.lineTo(0, 0); bg.fill();
  const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), beamMat); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.12, -5.2); car.add(beam);
  car.add(model);
  car.position.set(0, 0, 8);
  scene.add(car);

  /* ---------- Theme application ---------- */
  function applyTheme(t) {
    scene.background.lerpColors(P.day.sky, P.night.sky, t);
    scene.fog.color.copy(scene.background);
    groundMat.color.lerpColors(P.day.ground, P.night.ground, t);
    foliageMat.color.lerpColors(P.day.tree, P.night.tree, t);
    sun.intensity = lerp(P.day.sun, P.night.sun, t); sun.color.lerpColors(P.day.sunC, P.night.sunC, t);
    hemi.intensity = lerp(P.day.hemi, P.night.hemi, t); hemi.groundColor.lerpColors(P.day.hemiG, P.night.hemiG, t);
    windowMats.forEach((m) => (m.emissiveIntensity = t * P.night.win));
    lampMat.emissiveIntensity = lerp(P.day.lamp, P.night.lamp, t);
    beamMat.opacity = glowMat.opacity = t * 0.55; beamMat.visible = glowMat.visible = t > 0.02;
    fMat.opacity = t; grid.material.opacity = lerp(0.1, 0.28, t);
    renderer.toneMappingExposure = lerp(1.0, 1.15, t);
  }
  const setTheme = (night) => {
    themeTarget = night ? 1 : 0;
    document.body.dataset.theme = night ? 'night' : 'day';
    $('#theme').textContent = night ? '☀' : '☾';
    $('meta[name=theme-color]').content = night ? '#0a0f24' : '#bfe6ff';
  };
  $('#theme').addEventListener('click', () => setTheme(themeTarget === 0));
  applyTheme(1);

  /* ---------- UI: nav, panel, prompt ---------- */
  const nav = $('#nav'), panel = $('#panel'), panelBody = $('#panel-body'), prompt = $('#prompt');
  let started = false, openId = null, nearZone = null, travel = null;

  sections.forEach((s) => {
    const b = document.createElement('button');
    b.dataset.id = s.id; b.style.setProperty('--c', s.color);
    b.innerHTML = `<i></i>${s.nav}`;
    b.addEventListener('click', () => travelTo(s));
    nav.appendChild(b);
  });

  function openPanel(s) {
    openId = s.id;
    panelBody.innerHTML = sectionHTML(s);
    panel.style.setProperty('--accent', s.color);
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
    panelBody.scrollTop = 0; refreshPrompt();
  }
  function closePanel() { openId = null; panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); refreshPrompt(); }
  $('#panel-close').addEventListener('click', closePanel);

  function refreshPrompt() {
    const show = started && nearZone && openId !== nearZone.id && !travel;
    prompt.hidden = !show;
    if (show) {
      prompt.style.setProperty('--c', nearZone.color);
      prompt.innerHTML = isTouch ? `Tap to open <b>${nearZone.nav}</b>` : `Press <kbd>E</kbd> to open <b>${nearZone.nav}</b>`;
    }
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', nearZone?.id === b.dataset.id || openId === b.dataset.id));
  }
  prompt.addEventListener('click', () => nearZone && openPanel(nearZone));

  function travelTo(s) {
    if (!started || travel) return;
    travel = { t: 0, s, from: car.position.clone(), fromH: heading, dH: euclideanModulo(s.heading - heading + Math.PI, Math.PI * 2) - Math.PI };
    speed = 0; refreshPrompt();
  }

  /* ---------- Input ---------- */
  const keys = new Set(), touchIn = { x: 0, y: 0 };
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.target === document.body && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!started) return;
    if (k === 'e' || (k === 'enter' && e.target === document.body)) nearZone && openPanel(nearZone);
    else if (k === 'escape') closePanel();
    else if (k === 't') setTheme(themeTarget === 0);
    keys.add(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const stick = $('#joystick'), knob = $('.knob', stick);
  let stickId = null;
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect(), max = r.width / 2 - 14;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy); if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    touchIn.x = Math.abs(dx) < 8 ? 0 : -dx / max; touchIn.y = Math.abs(dy) < 8 ? 0 : -dy / max;
  };
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; touchIn.x = touchIn.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  // click a building to drive straight to it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('click', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bodies)[0];
    if (hit) travelTo(hit.object.userData.section);
  });

  $('#start').addEventListener('click', () => { started = true; $('#intro').classList.add('hidden'); setTimeout(() => $('#hint').classList.add('faded'), 9000); });
  $('#start').focus();

  /* ---------- Minimap ---------- */
  const mm = $('#minimap'), mg = mm.getContext('2d'), mmSize = 140;
  mm.width = mm.height = mmSize * Math.min(devicePixelRatio, 2); mg.scale(mm.width / mmSize, mm.width / mmSize);
  const toMap = (v) => ((v + WORLD) / (WORLD * 2)) * mmSize;
  function drawMinimap() {
    mg.clearRect(0, 0, mmSize, mmSize);
    mg.fillStyle = 'rgba(255,255,255,.18)'; mg.fillRect(toMap(-3), 0, toMap(3) - toMap(-3), mmSize); mg.fillRect(0, toMap(-3), mmSize, toMap(3) - toMap(-3));
    sections.forEach((s) => { mg.fillStyle = s.color; mg.beginPath(); mg.roundRect(toMap(s.x) - 8, toMap(s.z) - 8, 16, 16, 4); mg.fill(); mg.fillStyle = '#fff'; mg.font = '700 9px Inter, sans-serif'; mg.textAlign = 'center'; mg.fillText(s.nav[0], toMap(s.x), toMap(s.z) + 3); });
    mg.save(); mg.translate(toMap(car.position.x), toMap(car.position.z)); mg.rotate(-heading);
    mg.fillStyle = '#fff'; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 6); mg.lineTo(0, 3); mg.lineTo(-5, 6); mg.fill(); mg.restore();
  }

  /* ---------- Game loop ---------- */
  let heading = 0, speed = 0, camH = 0, roll = 0, time = 0, last = performance.now(), shownSpeed = -1;
  const MAX = 12, REV = -5, ACC = 14, BRAKE = 22, DRAG = 6, TURN = 2.2;
  const fwd = new THREE.Vector3(), camTarget = new THREE.Vector3(), look = new THREE.Vector3(), lookCur = new THREE.Vector3(0, 2, 0);
  const lerpAngle = (a, b, t) => a + (euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI) * t;
  const damp = (k, dt) => 1 - Math.exp(-k * dt);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;

    themeT += (themeTarget - themeT) * damp(3, dt);
    if (Math.abs(themeTarget - themeT) > 0.002) applyTheme(themeT);

    let steer = 0;
    if (travel) {
      travel.t = Math.min(1, travel.t + dt / 1.3);
      const e = travel.t * travel.t * (3 - 2 * travel.t);
      car.position.lerpVectors(travel.from, travel.s.pad, e);
      heading = travel.fromH + travel.dH * e;
      if (travel.t >= 1) { const s = travel.s; travel = null; openPanel(s); }
    } else if (started) {
      const k = (...n) => n.some((x) => keys.has(x)) ? 1 : 0;
      const throttle = clamp(k('w', 'arrowup') - k('s', 'arrowdown') + touchIn.y, -1, 1);
      steer = clamp(k('a', 'arrowleft') - k('d', 'arrowright') + touchIn.x, -1, 1);
      if (throttle > 0) speed += (speed < 0 ? BRAKE : ACC) * throttle * dt;
      else if (throttle < 0) speed -= (speed > 0 ? BRAKE : ACC * 0.6) * -throttle * dt;
      else { const d = DRAG * dt; speed = Math.abs(speed) <= d ? 0 : speed - Math.sign(speed) * d; }
      speed = clamp(speed, REV, MAX);
      heading += steer * TURN * dt * clamp(speed / 4, -1, 1);
      fwd.set(-Math.sin(heading), 0, -Math.cos(heading));
      car.position.addScaledVector(fwd, speed * dt);
      for (const s of sections) {
        const dx = car.position.x - s.x, dz = car.position.z - s.z, d = Math.hypot(dx, dz);
        if (d < COLLIDE && d > 0.001) { car.position.x = s.x + (dx / d) * COLLIDE; car.position.z = s.z + (dz / d) * COLLIDE; speed *= 0.9; }
      }
      car.position.x = clamp(car.position.x, -WORLD + 1.5, WORLD - 1.5);
      car.position.z = clamp(car.position.z, -WORLD + 1.5, WORLD - 1.5);
    }
    car.rotation.y = heading;
    roll = lerp(roll, -steer * clamp(speed / MAX, -1, 1) * 0.07, damp(8, dt));
    model.rotation.z = roll;
    wheels.forEach((w) => (w.rotation.x -= (speed * dt) / 0.3));

    // nearest interaction pad
    let near = null;
    for (const s of sections) if (Math.hypot(car.position.x - s.pad.x, car.position.z - s.pad.z) < ZONE_R) near = s;
    if (near !== nearZone) { nearZone = near; refreshPrompt(); }

    // world animation
    for (const s of sections) {
      const on = nearZone === s;
      s.ring.scale.setScalar(lerp(s.ring.scale.x, on ? 1.2 : 1, damp(8, dt)) + (reduceMotion ? 0 : Math.sin(time * 3) * 0.01));
      s.ring.material.opacity = on ? 1 : 0.7; s.disc.material.opacity = on ? 0.35 : 0.15;
    }
    floaters.forEach((f, i) => { f.icon.rotation.y += dt * 0.9; f.icon.rotation.x += dt * 0.35; f.icon.position.y = f.base + (reduceMotion ? 0 : Math.sin(time * 1.6 + i) * 0.25); });
    if (themeT > 0.02) {
      for (let i = 0; i < FN; i++) { fPos[i * 3] = fBase[i * 3] + Math.sin(time * 0.4 + i) * 0.8; fPos[i * 3 + 1] = fBase[i * 3 + 1] + Math.sin(time * 0.8 + i * 2) * 0.4; fPos[i * 3 + 2] = fBase[i * 3 + 2] + Math.cos(time * 0.35 + i) * 0.8; }
      fGeo.attributes.position.needsUpdate = true;
    }

    // camera: intro orbit, then chase cam
    const boost = camera.aspect < 0.8 ? 1.35 : 1;
    if (!started) {
      camTarget.set(Math.cos(time * 0.15) * 34, 15, Math.sin(time * 0.15) * 34 + 4); look.set(0, 2, 0);
    } else {
      camH = lerpAngle(camH, heading, damp(4, dt));
      const dist = (9 + Math.max(speed, 0) * 0.12) * boost;
      camTarget.set(car.position.x + Math.sin(camH) * dist, 6.2 * boost, car.position.z + Math.cos(camH) * dist);
      look.set(car.position.x - Math.sin(heading) * 3, 0.8, car.position.z - Math.cos(heading) * 3);
    }
    camera.position.lerp(camTarget, damp(5, dt));
    lookCur.lerp(look, damp(8, dt)); camera.lookAt(lookCur);
    const fov = 58 + (reduceMotion ? 0 : (Math.max(speed, 0) / MAX) * 10);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, damp(4, dt)); camera.updateProjectionMatrix(); }

    const kmh = Math.round(Math.abs(speed) * 5);
    if (kmh !== shownSpeed) { shownSpeed = kmh; $('#speed').textContent = `${kmh} km/h`; }
    drawMinimap();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  });
}
