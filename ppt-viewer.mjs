import { createPptViewer } from './vendor/pptjs/pptjs.mjs';

export async function renderLegacyPpt(data, container) {
  container.replaceChildren();
  const runtime = await createPptViewer({ worker: false, cache: false });
  return runtime.mount(container, new Uint8Array(data), {
    replace: true,
    className: 'ppt-slides',
    scale: 1,
    pixelRatio: 1,
    virtualize: true
  });
}
