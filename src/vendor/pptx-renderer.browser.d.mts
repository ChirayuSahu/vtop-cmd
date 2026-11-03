// The parts of the vendored pptx renderer (vendor/pptx-renderer.browser.mjs) that pptx-viewer uses.

export interface ZipLimits {
  maxEntries: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxMediaBytes: number;
  maxConcurrency: number;
}

export declare const RECOMMENDED_ZIP_LIMITS: Readonly<ZipLimits>;

export interface PptxListOptions {
  windowed?: boolean;
  batchSize?: number;
  initialSlides?: number;
  overscanViewport?: number;
  showSlideLabels?: boolean;
}

export interface PptxOpenOptions {
  renderMode?: 'list' | 'slide';
  listOptions?: PptxListOptions;
  signal?: AbortSignal;
  lazyMedia?: boolean;
  lazySlides?: boolean;
}

export interface PptxViewerOptions extends PptxOpenOptions {
  zipLimits?: Partial<ZipLimits>;
  externalMedia?: 'allow' | 'block';
  /** The element that scrolls the slide list; windowed overscan is measured against it. */
  scrollContainer?: HTMLElement | null;
}

export declare class PptxViewer extends EventTarget {
  /** Reads render mode, list options and the lazy flags from the viewer options. */
  static open(
    input: ArrayBuffer | Uint8Array | Blob,
    container: HTMLElement,
    options?: PptxViewerOptions
  ): Promise<PptxViewer>;
}
