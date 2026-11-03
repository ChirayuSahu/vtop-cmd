// The parts of the vendored MS-DOC parser (vendor/msdoc/modules/msdoc/parser.js) that word-viewer uses.

/** The parsed document model; only the HTML renderer looks inside it. */
export interface ParsedMsDoc {
  warnings?: unknown[];
  meta?: unknown;
  assets?: unknown[];
}

export declare function parseMsDoc(input: Uint8Array | ArrayBuffer, options?: Record<string, unknown>): ParsedMsDoc;
