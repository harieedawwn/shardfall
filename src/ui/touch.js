// Owner: UI. Touch controls (only on touch devices): floating move stick (left), aim+fire stick (right), dash and pause buttons.
// Feeds NR.input.setVirtual. Uses pointer events on two half-screen zones; shown only while a run is being played.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.ui = NR.ui || {};
  const R = 58;            // stick radius in css px
  const MOVE_DEAD = 0.12, FIRE_ON = 0.25;
  let box = null, on = false, enabled = false, playing = false, inited = false;
  const side = { l: null, r: null };   // per zone: { id, x0, y0, base, knob }
  let zoneL = null, zoneR = null, hintL = null, hintR = null, dashBtn = null, ultBtn = null, pauseBtn = null, dashT = 0, ultT = 0;

  function el(tag, cls, parent) { const e = document.createElement(tag); e.className = cls || ''; if (parent) parent.appendChild(e); return e; }
  function now() { const p = globalThis.performance; return p && p.now ? p.now() : Date.now(); }
  function detect() {
    const g = globalThis;
    try {
      if (g.matchMedia) {
        if (g.matchMedia('(pointer: coarse)').matches) return true;
        if (g.matchMedia('(any-pointer: coarse)').matches && !g.matchMedia('(hover: hover)').matches) return true;
      }
      return !!(g.navigator && g.navigator.maxTouchPoints > 0 && !(g.matchMedia && g.matchMedia('(hover: hover)').matches));
    } catch (e) { return false; }
  }
  function active() { return on; }
  function sync() {
    on = enabled && playing;
    if (box) box.style.display = on ? 'block' : 'none';
    if (!on && NR.input && NR.input.clearVirtual) { NR.input.clearVirtual(); resetSticks(); }
  }
  function show() { enabled = true; sync(); }
  function hide() { enabled = false; sync(); }

  function place(s, x, y, dx, dy) {
    s.base.style.transform = 'translate(' + (x - R) + 'px,' + (y - R) + 'px)';
    s.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function resetSticks() {
    for (const k of ['l', 'r']) {
      const s = side[k];
      if (s) { s.id = null; s.base.className = 'stk'; s.knob.style.transform = 'translate(0px,0px)'; }
    }
    if (hintL) hintL.style.display = 'block';
    if (hintR) hintR.style.display = 'block';
  }
  function vec(s, ev) {
    let dx = ev.clientX - s.x0, dy = ev.clientY - s.y0;
    const d = Math.sqrt(dx * dx + dy * dy), m = Math.min(1, d / R);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    return { dx: dx, dy: dy, m: m, a: Math.atan2(ev.clientY - s.y0, ev.clientX - s.x0), d: d };
  }
  function down(k, ev) {
    const s = side[k];
    if (s.id !== null) return;
    s.id = ev.pointerId; s.x0 = ev.clientX; s.y0 = ev.clientY;
    s.base.className = 'stk live';
    place(s, s.x0, s.y0, 0, 0);
    (k === 'l' ? hintL : hintR).style.display = 'none';
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    if (ev.preventDefault) ev.preventDefault();
    feed(k, ev);
  }
  function feed(k, ev) {
    const s = side[k], v = vec(s, ev);
    s.knob.style.transform = 'translate(' + v.dx + 'px,' + v.dy + 'px)';
    if (k === 'l') {
      if (v.m < MOVE_DEAD) NR.input.setVirtual({ mx: 0, my: 0 });
      else { const q = (v.m - MOVE_DEAD) / (1 - MOVE_DEAD); NR.input.setVirtual({ mx: Math.cos(v.a) * q, my: Math.sin(v.a) * q }); }
    } else if (v.m >= FIRE_ON) NR.input.setVirtual({ aim: v.a, fire: true });
    else NR.input.setVirtual({ fire: false });
  }
  function move(k, ev) { const s = side[k]; if (s.id === ev.pointerId) { if (ev.preventDefault) ev.preventDefault(); feed(k, ev); } }
  function up(k, ev) {
    const s = side[k];
    if (s.id !== ev.pointerId) return;
    s.id = null; s.base.className = 'stk';
    (k === 'l' ? hintL : hintR).style.display = 'block';
    if (k === 'l') NR.input.setVirtual({ mx: 0, my: 0 }); else NR.input.setVirtual({ fire: false });
  }
  function wireZone(z, k) {
    z.addEventListener('pointerdown', function (ev) { down(k, ev); });
    z.addEventListener('pointermove', function (ev) { move(k, ev); });
    z.addEventListener('pointerup', function (ev) { up(k, ev); });
    z.addEventListener('pointercancel', function (ev) { up(k, ev); });
  }

  function pressDash(ev) {
    if (ev.preventDefault) ev.preventDefault();
    if (ev.stopPropagation) ev.stopPropagation();
    dashT = now();
    dashBtn.className = 'tbtn dash down';
    NR.input.setVirtual({ dash: true });
  }
  function releaseDash() {
    dashBtn.className = 'tbtn dash';
    const wait = Math.max(0, 90 - (now() - dashT));
    if (globalThis.setTimeout) globalThis.setTimeout(function () { NR.input.setVirtual({ dash: false }); }, wait); else NR.input.setVirtual({ dash: false });
  }

  function pressUlt(ev) {
    if (ev.preventDefault) ev.preventDefault();
    if (ev.stopPropagation) ev.stopPropagation();
    ultT = now();
    ultBtn.className = 'tbtn ult down';
    NR.input.setVirtual({ ult: true });
  }
  function releaseUlt() {
    ultBtn.className = 'tbtn ult';
    const wait = Math.max(0, 90 - (now() - ultT));
    if (globalThis.setTimeout) globalThis.setTimeout(function () { NR.input.setVirtual({ ult: false }); }, wait); else NR.input.setVirtual({ ult: false });
  }

  function init(root) {
    if (inited || !root) return;
    inited = true;
    box = el('div', 'touch', root); box.style.display = 'none';
    zoneL = el('div', 'zone zl', box); zoneR = el('div', 'zone zr', box);
    hintL = el('div', 'stk hint hl', box); hintR = el('div', 'stk hint hr', box);
    for (const k of ['l', 'r']) {
      const base = el('div', 'stk', box), knob = el('div', 'knob', base);
      side[k] = { id: null, x0: 0, y0: 0, base: base, knob: knob };
    }
    wireZone(zoneL, 'l'); wireZone(zoneR, 'r');
    dashBtn = el('button', 'tbtn dash', box); dashBtn.setAttribute('type', 'button'); dashBtn.setAttribute('aria-label', NR.i18n.t('touch.dash'));
    el('span', 'tb-ic', dashBtn);
    dashBtn.addEventListener('pointerdown', pressDash);
    dashBtn.addEventListener('pointerup', releaseDash);
    dashBtn.addEventListener('pointercancel', releaseDash);
    ultBtn = el('button', 'tbtn ult', box); ultBtn.setAttribute('type', 'button'); ultBtn.setAttribute('aria-label', 'Ultimate');
    el('span', 'tb-ic', ultBtn);
    ultBtn.addEventListener('pointerdown', pressUlt);
    ultBtn.addEventListener('pointerup', releaseUlt);
    ultBtn.addEventListener('pointercancel', releaseUlt);
    pauseBtn = el('button', 'tbtn pause', box); pauseBtn.setAttribute('type', 'button'); pauseBtn.setAttribute('aria-label', NR.i18n.t('pause.title'));
    el('i', '', pauseBtn); el('i', '', pauseBtn);
    pauseBtn.addEventListener('pointerdown', function (ev) { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); NR.input.setVirtual({ pause: true }); });
    NR.events.on('settings:change', function (e) {
      if (e.key === 'language') { dashBtn.setAttribute('aria-label', NR.i18n.t('touch.dash')); pauseBtn.setAttribute('aria-label', NR.i18n.t('pause.title')); }
    });
    NR.events.on('state:change', function (e) {
      playing = e.to === 'wave' || e.to === 'clear';
      sync();
    });
    // a touch pointer anywhere turns the controls on, a mouse pointer turns them off (hybrid devices)
    if (globalThis.document && globalThis.document.addEventListener) {
      globalThis.document.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'touch' && !enabled) show();
        else if (ev.pointerType === 'mouse' && enabled) hide();
      }, true);
    }
    enabled = detect();
    playing = NR.world && (NR.world.get().state === 'wave' || NR.world.get().state === 'clear');
    sync();
  }
  NR.ui.touch = { init: init, show: show, hide: hide, active: active };
})();
