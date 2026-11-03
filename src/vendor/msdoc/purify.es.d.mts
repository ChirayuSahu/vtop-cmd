// The parts of the vendored DOMPurify (vendor/msdoc/purify.es.mjs) that word-viewer uses.

export interface SanitizeConfig {
  RETURN_DOM_FRAGMENT?: boolean;
  USE_PROFILES?: { html?: boolean; svg?: boolean; svgFilters?: boolean; mathMl?: boolean };
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
}

export interface DOMPurify {
  /** Creates a purifier bound to another window. */
  (root?: Window | null): DOMPurify;
  readonly isSupported: boolean;
  sanitize(dirty: string | Node, config: SanitizeConfig & { RETURN_DOM_FRAGMENT: true }): DocumentFragment;
  sanitize(dirty: string | Node, config?: SanitizeConfig): string;
}

declare const purify: DOMPurify;
export default purify;
