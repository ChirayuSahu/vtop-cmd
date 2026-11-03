// The parts of the vendored PDF.js (vendor/pdf.mjs, v6.5) that the PDF viewer uses.

export declare class GlobalWorkerOptions {
  static workerSrc: string;
}

export declare const VerbosityLevel: { readonly ERRORS: 0; readonly WARNINGS: 1; readonly INFOS: 5 };

export interface DocumentInitParameters {
  data?: Uint8Array;
  verbosity?: number;
  isEvalSupported?: boolean;
  useWasm?: boolean;
  useSystemFonts?: boolean;
  cMapUrl?: string;
  cMapPacked?: boolean;
  standardFontDataUrl?: string;
}

/** 1 = a password is needed, 2 = the supplied password was wrong (PasswordResponses). */
export type PasswordReason = 1 | 2;

export declare class PDFDocumentLoadingTask {
  readonly promise: Promise<PDFDocumentProxy>;
  destroy(): Promise<void>;
  onPassword: ((updatePassword: (password: string | Error) => void, reason: PasswordReason) => void) | null;
}

export declare function getDocument(src: DocumentInitParameters): PDFDocumentLoadingTask;

export interface PDFDocumentProxy {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
}

export interface PageViewport {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

export interface RenderParameters {
  canvasContext: CanvasRenderingContext2D;
  viewport: PageViewport;
  transform?: number[] | null;
}

export interface RenderTask {
  readonly promise: Promise<void>;
  cancel(extraDelay?: number): void;
}

export interface TextItem { str: string }
/** Marked-content markers carry no text. */
export interface TextMarkedContent { type: string; id?: string; str?: undefined }
export interface TextContent { items: Array<TextItem | TextMarkedContent> }

export interface PDFPageProxy {
  getViewport(params: { scale: number }): PageViewport;
  render(params: RenderParameters): RenderTask;
  getTextContent(): Promise<TextContent>;
}
