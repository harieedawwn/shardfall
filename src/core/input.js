(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const DEAD = 0.2, ASSIST_ANGLE = 12 * Math.PI / 180, ASSIST_RANGE = 400, AUTOFIRE_RANGE = 520;
  const keys = Object.create(null);
  const mouse = { sx: 640, sy: 360, x: 640, y: 360, left: false, right: false };
  const virt = { mx: 0, my: 0, aim: null, fire: false, dash: false, pause: false, active: false };
  const pad = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, dash: false, aiming: false, start: false, prevStart: false, connected: false, ult: false };
  const intent = { mx: 0, my: 0, aim: 0, fire: false, dash: false, pause: false, device: 'kbm' };
  const tmp = { x: 0, y: 0 };
  let canvas = null, injected = null, device = 'kbm', pauseReq = false, lastAim = 0, inited = false;

  function setDevice(d) {
    if (d === device) return;
    device = d;
    NR.events.emit('input:device', { device: d });
  }
  function clearKeys() {
    for (const k in keys) delete keys[k];
    mouse.left = false; mouse.right = false;
  }
  function init(c) {
    canvas = c || null;
    if (inited) return;
    inited = true;
    const g = globalThis;
    if (!g.addEventListener) return;
    g.addEventListener('keydown', function (e) {
      const k = e.code;
      if (k === 'Escape') { if (!e.repeat) pauseReq = true; return; }
      if (k === 'Space' || k.indexOf('Arrow') === 0) e.preventDefault();
      keys[k] = true; setDevice('kbm');
    });
    g.addEventListener('keyup', function (e) { delete keys[e.code]; });
    g.addEventListener('blur', clearKeys);
    if (g.document && g.document.addEventListener) {
      g.document.addEventListener('visibilitychange', function () { if (g.document.hidden) clearKeys(); });
    }
    const target = canvas || g;
    if (target.addEventListener) {
      target.addEventListener('mousemove', function (e) { mouseXY(e); setDevice('kbm'); });
      target.addEventListener('mousedown', function (e) {
        mouseXY(e);
        if (e.button === 0) mouse.left = true; else if (e.button === 2) mouse.right = true;
        setDevice('kbm');
      });
      target.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    g.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.left = false; else if (e.button === 2) mouse.right = false; });
  }
  // client coords -> world-view pixels; the renderer owns the screen mapping (DPR, 21:9 frame) when it is loaded
  function mouseXY(e) {
    const R = NR.fx && NR.fx.render;
    if (R && R.toView) { R.toView(e.clientX, e.clientY, mouse); mouse.sx = mouse.x; mouse.sy = mouse.y; return; }
    if (!canvas || !canvas.getBoundingClientRect) return;
    const r = canvas.getBoundingClientRect();
    const sc = Math.min(r.width / canvas.width, r.height / canvas.height) || 1;
    const ox = (r.width - canvas.width * sc) / 2, oy = (r.height - canvas.height * sc) / 2;
    mouse.sx = (e.clientX - r.left - ox) / sc;
    mouse.sy = (e.clientY - r.top - oy) / sc;
  }
  function dz(x, y, out) { // radial deadzone, rescaled
    const m = Math.sqrt(x * x + y * y);
    if (m < DEAD) { out.x = 0; out.y = 0; return 0; }
    const s = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
    out.x = x * s; out.y = y * s;
    return Math.min(1, (m - DEAD) / (1 - DEAD));
  }
  const dzo = { x: 0, y: 0 };
  function pollPad() {
    pad.mx = 0; pad.my = 0; pad.ax = 0; pad.ay = 0; pad.fire = false; pad.dash = false; pad.ult = false; pad.aiming = false; pad.connected = false;
    const nav = globalThis.navigator;
    const pads = nav && nav.getGamepads ? nav.getGamepads() : null;
    if (!pads) return;
    let gp = null;
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (!gp) return;
    pad.connected = true;
    const a = gp.axes || [], b = gp.buttons || [];
    dz(a[0] || 0, a[1] || 0, dzo); pad.mx = dzo.x; pad.my = dzo.y;
    const am = dz(a[2] || 0, a[3] || 0, dzo); pad.ax = dzo.x; pad.ay = dzo.y; pad.aiming = am > 0;
    const pressed = function (i) { return b[i] && (b[i].pressed || b[i].value > 0.5); };
    pad.fire = !!(pressed(7) || am > 0.5);
    pad.dash = !!(pressed(0) || pressed(4) || pressed(5));
    pad.ult = !!pressed(3);
    pad.start = !!pressed(9);
    if (pad.start && !pad.prevStart) pauseReq = true;
    pad.prevStart = pad.start;
    if (pad.mx || pad.my || pad.aiming || pad.fire || pad.dash) setDevice('pad');
  }

  function player() { const W = NR.world && NR.world.get(); return W && W.player ? W.player : null; }

  function read() {
    if (injected) {
      intent.mx = injected.mx || 0; intent.my = injected.my || 0;
      intent.aim = injected.aim || 0; intent.fire = !!injected.fire; intent.dash = !!injected.dash;
      intent.pause = !!injected.pause; intent.device = injected.device || 'kbm';
      if (injected.pause) pauseReq = true;
      return intent;
    }
    pollPad();
    const p = player();
    let mx = 0, my = 0;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    mx += pad.mx + virt.mx; my += pad.my + virt.my;
    const m = Math.sqrt(mx * mx + my * my);
    if (m > 1) { mx /= m; my /= m; }
    let aim = lastAim, fire = false;
    if (device === 'kbm') {
      if (p) { NR.camera.toWorld(mouse.sx, mouse.sy, tmp); aim = Math.atan2(tmp.y - p.y, tmp.x - p.x); }
      fire = mouse.left;
    } else if (device === 'pad') {
      if (pad.aiming) aim = Math.atan2(pad.ay, pad.ax);
      fire = pad.fire;
    } else {
      if (virt.aim !== null) aim = virt.aim;
      fire = virt.fire;
    }
    if (virt.fire) fire = true;
    if (device !== 'kbm' && p && NR.save.getSettings().aimAssist) {
      const e = NR.spatial.nearest(p.x, p.y, ASSIST_RANGE);
      if (e) {
        const ea = Math.atan2(e.y - p.y, e.x - p.x);
        let d = ea - aim; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) <= ASSIST_ANGLE) aim = ea;
      }
    }
    if (p && NR.save.getSettings().autoFire && NR.spatial.nearest(p.x, p.y, AUTOFIRE_RANGE)) fire = true;
    lastAim = aim;
    intent.mx = mx; intent.my = my; intent.aim = aim; intent.fire = fire;
    intent.dash = !!(keys.Space || keys.ShiftLeft || keys.ShiftRight || mouse.right || pad.dash || virt.dash);
    intent.ult = !!(keys.KeyQ || virt.ult || pad.ult);
    intent.pause = pauseReq || virt.pause;
    intent.device = device;
    return intent;
  }
  function consumePause() {
    const r = pauseReq || virt.pause;
    pauseReq = false; virt.pause = false;
    return r;
  }
  function setVirtual(part) {
    if (part.mx !== undefined) virt.mx = part.mx;
    if (part.my !== undefined) virt.my = part.my;
    if (part.aim !== undefined) virt.aim = part.aim;
    if (part.fire !== undefined) virt.fire = !!part.fire;
    if (part.dash !== undefined) virt.dash = !!part.dash;
    if (part.ult !== undefined) virt.ult = !!part.ult;
    if (part.pause) virt.pause = true;
    virt.active = true;
    setDevice('touch');
  }
  function clearVirtual() { virt.mx = 0; virt.my = 0; virt.aim = null; virt.fire = false; virt.dash = false; virt.ult = false; virt.pause = false; virt.active = false; }
  function inject(i) { injected = i || null; }
  NR.input = { init, read, consumePause, setVirtual, clearVirtual, inject };
})();
