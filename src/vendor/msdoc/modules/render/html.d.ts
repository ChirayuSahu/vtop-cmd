// The parts of the vendored MS-DOC HTML renderer (vendor/msdoc/modules/render/html.js) that word-viewer uses.
import type { ParsedMsDoc } from '../msdoc/parser.js';

export interface MsDocRenderOptions {
  css?: string;
  reviewMode?: 'all' | 'final' | 'original';
  externalLinkPolicy?: 'allow' | 'block';
  externalResourcePolicy?: 'allow' | 'block';
}

export interface MsDocRenderResult {
  html: string;
  css: string;
  warnings: unknown[];
  meta: unknown;
  assets: unknown[];
  parsed: ParsedMsDoc;
}

export declare function defaultMsDocCss(): string;
export declare function renderMsDoc(parsed: ParsedMsDoc, options?: MsDocRenderOptions): MsDocRenderResult;
