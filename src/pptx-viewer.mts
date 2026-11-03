import { PptxViewer, RECOMMENDED_ZIP_LIMITS } from './vendor/pptx-renderer.browser.mjs';

export async function renderPptx(data: ArrayBuffer, container: HTMLElement) {
  container.replaceChildren();
  return PptxViewer.open(
    new Uint8Array(data),
    container,
    {
      zipLimits: RECOMMENDED_ZIP_LIMITS,
      lazyMedia: true,
      lazySlides: true,
      externalMedia: 'block'
    },
    {
      renderMode: 'list',
      listOptions: {
        windowed: true,
        initialSlides: 4,
        overscanViewport: 1.5
      }
    }
  );
}
