import { parseMsDoc } from './vendor/msdoc/modules/msdoc/parser.js';
import { defaultMsDocCss, renderMsDoc } from './vendor/msdoc/modules/render/html.js';
import createDOMPurify from './vendor/msdoc/purify.es.mjs';

export async function renderWord(data: ArrayBuffer, container: HTMLElement, documentType: string) {
  container.replaceChildren();
  if (documentType === 'doc') {
    const rendered = renderMsDoc(parseMsDoc(new Uint8Array(data)), {
      externalLinkPolicy: 'block',
      externalResourcePolicy: 'block'
    });
    const purifier = createDOMPurify(container.ownerDocument.defaultView);
    const content = purifier.sanitize(rendered.html, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['base', 'embed', 'form', 'iframe', 'object', 'script', 'style', 'template'],
      FORBID_ATTR: ['action', 'formaction', 'srcdoc']
    });
    const style = container.ownerDocument.createElement('style');
    style.textContent = `${defaultMsDocCss()}\n${rendered.css}`;
    const root = container.ownerDocument.createElement('div');
    root.className = 'msdoc-root';
    root.append(content);
    container.replaceChildren(style, root);
    return;
  }

  await import('./vendor/docx/jszip.min.mjs');
  await import('./vendor/docx/docx-preview.min.mjs');
  const { renderAsync } = globalThis.docx;
  await renderAsync(new Uint8Array(data), container, container.ownerDocument.head, {
    inWrapper: true,
    breakPages: true,
    renderAltChunks: false,
    externalLinkPolicy: 'block',
    externalResourcePolicy: 'block',
    useWorker: false
  });
}
