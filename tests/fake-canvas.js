'use strict';
// No-op 2D context that records which methods/properties were used, and flags banned visual features.
const BANNED_METHODS = ['createLinearGradient', 'createRadialGradient', 'createConicGradient'];
const BANNED_PROPS = ['shadowBlur', 'shadowColor', 'filter'];
const BAD_COMPOSITE = ['lighter', 'screen', 'plus-lighter', 'color-dodge'];
const INITIAL = {
  globalAlpha: 1, lineWidth: 1, fillStyle: '#000000', strokeStyle: '#000000', lineJoin: 'miter', lineCap: 'butt',
  font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: true, miterLimit: 10, lineDashOffset: 0
};

function create(w, h) {
  const used = { methods: {}, props: {} };
  const banned = [];
  const state = Object.assign({}, INITIAL);
  const canvas = { width: w || 1280, height: h || 720, style: {} };
  const own = { banned: banned, used: used, canvas: canvas };
  const ctx = new Proxy(own, {
    get(t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in t) return t[k];
      if (BANNED_METHODS.indexOf(k) >= 0) return function () { banned.push(k); return { addColorStop: function () {} }; };
      if (k in state) return state[k];
      return function () {
        used.methods[k] = (used.methods[k] || 0) + 1;
        if (k === 'measureText') return { width: String(arguments[0]).length * 6 };
        if (k === 'createPattern') return {};
        if (k === 'getImageData') return { data: [] };
        if (k === 'getTransform') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        return undefined;
      };
    },
    set(t, k, v) {
      used.props[k] = (used.props[k] || 0) + 1;
      state[k] = v;
      if (BANNED_PROPS.indexOf(k) >= 0) banned.push(k + '=' + v);
      if (k === 'globalCompositeOperation' && BAD_COMPOSITE.indexOf(v) >= 0) banned.push(k + '=' + v);
      return true;
    }
  });
  canvas.getContext = function () { return ctx; };
  return ctx;
}

// ---- minimal fake DOM for ui tests ----
class El {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase(); this.doc = doc; this.children = []; this.style = {}; this.dataset = {};
    this.attrs = {}; this.listeners = {}; this.className = ''; this._text = ''; this._html = ''; this.parentNode = null;
    this.value = ''; this.id = ''; this.width = 300; this.height = 150; this.disabled = false;
    const self = this;
    this.classList = {
      add(c) { if (!self.hasClass(c)) self.className = (self.className + ' ' + c).trim(); },
      remove(c) { self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
      toggle(c, on) { const has = self.hasClass(c); if (on === undefined ? !has : on) this.add(c); else this.remove(c); },
      contains(c) { return self.hasClass(c); }
    };
  }
  hasClass(c) { return this.className.split(/\s+/).indexOf(c) >= 0; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  append() { for (let i = 0; i < arguments.length; i++) { const a = arguments[i]; this.appendChild(typeof a === 'string' ? this.doc.createTextNode(a) : a); } }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren() { this.children.length = 0; this._text = ''; this._html = ''; for (let i = 0; i < arguments.length; i++) this.appendChild(arguments[i]); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener(t, f) { const a = this.listeners[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
  dispatch(t, ev) { const a = this.listeners[t] || []; ev = ev || {}; ev.target = this; ev.preventDefault = ev.preventDefault || function () {}; for (const f of a.slice()) f(ev); }
  click() { this.dispatch('click', {}); }
  focus() {} blur() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  getContext() { return this._ctx || (this._ctx = create(this.width, this.height)); }
  get textContent() { return this._text + this.children.map(function (c) { return c.textContent; }).join(''); }
  set textContent(v) { this.children.length = 0; this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this.children.length = 0; this._text = ''; this._html = String(v); }
  matches(sel) {
    if (sel[0] === '#') return this.id === sel.slice(1);
    if (sel[0] === '.') return this.hasClass(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) { const out = []; (function walk(n) { for (const c of n.children) { if (c.matches && c.matches(sel)) out.push(c); walk(c); } })(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function fakeDom() {
  const registry = {}, docListeners = {};
  const doc = {
    readyState: 'loading', hidden: false,
    createElement(tag) { return new El(tag, doc); },
    createTextNode(s) { const e = new El('#text', doc); e._text = String(s); return e; },
    getElementById(id) { return registry[id] || null; },
    addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
    removeEventListener() {},
    fire(t, ev) { (docListeners[t] || []).forEach(function (f) { f(ev || {}); }); }
  };
  doc.body = new El('body', doc);
  doc.documentElement = new El('html', doc);
  const canvas = new El('canvas', doc); canvas.id = 'game'; canvas.width = 1280; canvas.height = 720;
  const root = new El('div', doc); root.id = 'ui';
  registry.game = canvas; registry.ui = root;
  doc.body.appendChild(canvas); doc.body.appendChild(root);
  return { document: doc, root: root, canvas: canvas, ctx: canvas.getContext('2d') };
}
module.exports = { create: create, fakeDom: fakeDom, El: El };
