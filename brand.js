(function (root) {
  'use strict';
  // One visual language for the command menu, the PDF preview and the PDF viewer.
  const logo = "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"logo\" aria-hidden=\"true\" width=\"22\" height=\"22\" viewBox=\"0 0 128 128\" fill=\"none\">\n  <defs><linearGradient id=\"vtop-logo-bg\" x1=\"12\" y1=\"8\" x2=\"116\" y2=\"128\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#244B86\"/><stop offset=\"1\" stop-color=\"#101B34\"/></linearGradient></defs>\n  <rect x=\"2\" y=\"2\" width=\"124\" height=\"124\" rx=\"30\" fill=\"url(#vtop-logo-bg)\"/>\n  <rect x=\"3\" y=\"3\" width=\"122\" height=\"122\" rx=\"29\" stroke=\"#86B5FF\" stroke-opacity=\".22\" stroke-width=\"2\"/>\n  <path d=\"M29 40L59 88L92 39\" stroke=\"#F4F8FF\" stroke-width=\"11\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M78 32H97V51\" stroke=\"#61E1E3\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>";
  const tokens = {
    light: '--surface:#fff;--text:#182438;--muted:#748093;--line:#e8ecf2;--hover:#f0f4fb;--accent:#3664d9;--backdrop:#eef1f6',
    dark: '--surface:#171d29;--text:#edf1fa;--muted:#97a4bb;--line:#2a3344;--hover:#242f46;--accent:#a9beff;--backdrop:#0e131c'
  };
  const font = '14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  const nav = root.navigator || {};
  const mac = /Mac|iPhone|iPad/i.test(nav.userAgentData?.platform || nav.platform || '');
  // ⌘K on macOS, Ctrl+K on Windows/Linux (the Windows key belongs to the OS).
  const defaultBinding = { key: 'k', code: 'KeyK', shiftKey: false, altKey: false };
  let binding = { ...defaultBinding };
  const shortcut = {
    mac,
    get label() {
      return [mac ? '⌘' : 'Ctrl', ...(binding.shiftKey ? ['Shift'] : []), ...(binding.altKey ? ['Alt'] : []), binding.key.toUpperCase()].join(' ');
    },
    set(value) {
      if (!value || typeof value.key !== 'string' || typeof value.code !== 'string' ||
          !/^(?:[a-z0-9]|f(?:[1-9]|1[0-2]))$/i.test(value.key) ||
          !/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/.test(value.code)) return false;
      binding = { key: value.key.toLowerCase(), code: value.code, shiftKey: value.shiftKey === true, altKey: value.altKey === true };
      return true;
    },
    matches: event => (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
      event.altKey === binding.altKey && event.shiftKey === binding.shiftKey &&
      (event.key?.toLowerCase() === binding.key || event.code === binding.code),
    eventInit: () => ({ key: binding.key, code: binding.code, metaKey: mac, ctrlKey: !mac, shiftKey: binding.shiftKey, altKey: binding.altKey })
  };
  function setMarkup(target, markup) {
    const svg = target.namespaceURI === 'http://www.w3.org/2000/svg';
    const parsed = new DOMParser().parseFromString(
      svg ? `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>` : `<div>${markup}</div>`,
      svg ? 'image/svg+xml' : 'text/html'
    );
    const source = svg ? parsed.documentElement : parsed.body.firstElementChild;
    if (!source || svg && source.localName === 'parsererror') throw new Error('Unable to parse extension UI markup.');
    source.querySelectorAll('script,iframe,object,embed,base,meta,link,foreignObject,parsererror').forEach(element => element.remove());
    for (const element of [source, ...source.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name) ||
            /^(?:href|src|xlink:href|formaction)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    const fragment = target.ownerDocument.createDocumentFragment();
    for (const node of [...source.childNodes]) fragment.append(target.ownerDocument.importNode(node, true));
    target.replaceChildren(fragment);
  }
  const api = { logo, tokens, font, shortcut, setMarkup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VtopBrand = api;
})(globalThis);
