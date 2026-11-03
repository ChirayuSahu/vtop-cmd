// Globals that come from the browser or the test runner rather than from our own scripts.
// Each of our shared libraries declares its own global API at the top of its file.

// Firefox exposes the WebExtension API as `browser`; Chrome only has `chrome`.
declare var browser: typeof chrome | undefined;

// Present when Node's test runner loads a library directly, so it can export instead of
// assigning a global.
declare var module: { exports: unknown } | undefined;

// The Chrome service worker loads the background scripts with importScripts.
declare function importScripts(...urls: string[]): void;
