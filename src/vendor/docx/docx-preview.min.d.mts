// vendor/docx/docx-preview.min.mjs is imported for its side effect: it sets globalThis.docx.

export interface DocxRenderOptions {
  inWrapper?: boolean;
  breakPages?: boolean;
  renderAltChunks?: boolean;
  externalLinkPolicy?: 'allow' | 'block';
  externalResourcePolicy?: 'allow' | 'block';
  useWorker?: boolean;
}

export interface DocxPreview {
  renderAsync(
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: DocxRenderOptions
  ): Promise<unknown>;
}

declare global {
  var docx: DocxPreview;
}
