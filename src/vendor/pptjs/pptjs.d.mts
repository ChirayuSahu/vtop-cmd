// The parts of the vendored pptjs (vendor/pptjs/pptjs.mjs) that ppt-viewer uses.

export interface PptViewerRuntimeOptions {
  worker?: boolean;
  workerUrl?: string | URL;
  /** Not read by this build. */
  cache?: boolean;
  transferInputOwnership?: boolean;
}

export interface PptMountOptions {
  replace?: boolean;
  className?: string;
  scale?: number;
  pixelRatio?: number;
  virtualize?: boolean;
  releaseDelayMs?: number;
  scrollRoot?: Element | null;
  rootMargin?: string;
}

export interface PptMountedPresentation {
  readonly root: HTMLDivElement;
  readonly canvases: HTMLCanvasElement[];
  readonly virtualized: boolean;
  close(): Promise<void>;
}

export interface PptViewerRuntime {
  readonly mode: 'worker' | 'direct';
  mount(target: Element | string, input: ArrayBuffer | Uint8Array, options?: PptMountOptions): Promise<PptMountedPresentation>;
  close(): Promise<void>;
}

/** Without a container, resolves to a runtime that can open and mount presentations. */
export declare function createPptViewer(options?: PptViewerRuntimeOptions): Promise<PptViewerRuntime>;
