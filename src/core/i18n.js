(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  let lang = 'vi';
  function dict(l) { return (NR.lang && NR.lang[l]) || {}; }
  function t(key, params) {
    let s = dict(lang)[key];
    if (s === undefined) s = dict('en')[key];
    if (s === undefined) s = key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; });
    return s;
  }
  function text(o) {
    if (o === null || o === undefined) return '';
    if (typeof o === 'string') return o;
    return o[lang] || o.en || o.vi || '';
  }
  function setLang(l) { if (l === 'vi' || l === 'en') lang = l; }
  function getLang() { return lang; }
  function init() {
    setLang(NR.save.getSettings().language);
    NR.events.on('settings:change', function (e) { if (e.key === 'language') setLang(e.value); });
  }
  NR.i18n = { init, t, text, setLang, getLang };
})();
