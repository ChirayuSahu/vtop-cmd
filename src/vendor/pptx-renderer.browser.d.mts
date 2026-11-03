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
}

export declare class PptxViewer extends EventTarget {
  /**
   * The vendored build reads only the first three arguments; the viewer options double as the
   * open options. The fourth parameter exists only so the existing call type-checks.
   */
  static open(
    input: ArrayBuffer | Uint8Array | Blob,
    container: HTMLElement,
    options?: PptxViewerOptions,
    ignored?: PptxOpenOptions
  ): Promise<PptxViewer>;
}
