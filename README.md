# VTOP Command

A browser extension for VIT's VTOP portal. It adds a customizable keyboard shortcut for the command menu (⌘K / Ctrl+K by default), a dark mode, and helpers for attendance, assignments, marks and CGPA.

It runs only on `vtop.vit.ac.in/vtop/`, talks to no other server, and never submits anything on your behalf.

## Install

**Firefox / Zen**

Install [VTOP Command from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/vtop-cmd/) and click **Add to Firefox**. It updates automatically.

If the listing is still in review, download the signed `vtop-command-<version>.xpi` from the [latest release](https://github.com/ChirayuSahu/vtop-cmd/releases/latest), open `about:addons`, click the gear icon, choose **Install Add-on From File…** and select it.

**Chrome / Brave**

1. Download `vtop-command-<version>.zip` from the [latest release](https://github.com/ChirayuSahu/vtop-cmd/releases/latest) and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Features

- **Command menu:** press ⌘K / Ctrl+K by default on any VTOP page to search and open any page, with aliases (`DA`, `CGPA`, `marks`) and typo-tolerant matching. Use **Shortcut** in the menu to record another Ctrl/Command shortcut; Shift and Alt are optional.
- **Personal ordering:** frequently and recently selected commands rise to the top. Usage weight halves every seven days; typed searches still prioritize text matches, and all commands remain available.
- **Dark mode:** covers the whole portal and keeps text readable. Images, charts and documents keep their colours.
- **Default semester:** choose your semester once and it's selected automatically when a page first loads. Registration, payment and similar pages are never touched.
- **Attendance:** shows how many classes you need to reach 75%, or how many you can still miss.
- **Pending assignments:** Digital Assignment Upload lists each course's unsubmitted work with due dates and countdowns.
- **Marks totals:** each course's marks table gets a total row, including marks already lost.
- **CGPA calculator:** reads your grade history and current courses, and projects your GPA and CGPA from the grades you expect.
- **Document viewer:** PDF, Word and PowerPoint files from VTOP open in a built-in viewer, rendered locally. Shift-click a link to download normally.
- **CAPTCHA autofill:** VTOP's image CAPTCHA is read on your device. You still sign in yourself.
- **Late Hour Request preset:** saves your usual answers and fills them in. You review and submit the form yourself.
- **Searchable dropdowns** in the extension's windows and on long VTOP forms.

## Privacy and safety

- **Read-only.** It never submits forms, uploads files, registers, pays or changes anything on your account.
- **VTOP's own requests only.** Everything it sends is a request VTOP's own menus and buttons already make, with your existing session. Automatic requests run one at a time, and results are cached so VTOP isn't asked twice.
- **Nothing leaves your browser.** No analytics, tracking or remote code. Your password is never seen or stored.
- **Command history:** up to 300 command IDs, weighted counts and last-used timestamps stay in `storage.local`, shared within this browser profile across tabs and restarts. Older entries are evicted at the limit; removing the extension clears its history.
- **Stored locally:** your theme, default semester, presets and grade predictions in browser storage, and a short-lived assignment cache that clears on upload or when the browser closes.

No extension can promise how VIT will treat it, but this one is designed to look like a student clicking through the portal, and to be lighter than that.

## Development

Requires Node.js 24, npm 11 and Python 3.12+.

The extension is written in TypeScript. The repo is laid out as:

| Folder | Contents |
| --- | --- |
| `src/` | TypeScript sources (edit these) |
| `static/` | Files shipped as they are: `manifest.json`, the document viewer page, styles, icons, the CAPTCHA model and its license |
| `vendor/` | Bundled third-party libraries (PDF.js, PowerPoint and Word renderers) |
| `build/` | `tsc` output, one plain script per source file (git-ignored) |
| `dist/` | Built Chrome and Firefox packages (git-ignored) |
| `scripts/`, `tests/` | Packaging scripts and tests |
| `website/` | The homepage (separate Next.js app) |

```bash
npm ci
npm run check   # type check
npm test        # compile, then unit and DOM tests
npm run build   # compile, then Chrome and Firefox packages in dist/
npm run source  # source archive for Firefox Add-ons review
```

To try a local build, load `dist/vtop-command/` in Chrome (**Load unpacked**) or `dist/vtop-command-firefox/manifest.json` in Firefox (`about:debugging` → **Load Temporary Add-on…**).

The homepage is a separate Next.js app in `website/`: run `npm ci && npm run dev` there. It's served at [vtop-cmd.chirayusahu.com](https://vtop-cmd.chirayusahu.com/); production builds use that address for canonical links, the sitemap and the social preview image. Set `SITE_URL` to use a different one.

Tests use made-up data shaped like VTOP's markup; no account data is included.

### Releases

Pull requests must pass CI (checks, tests, both builds and `web-ext lint`) before merging into `main`. To release, bump the version in `static/manifest.json` and `package.json`, merge to `main`, then tag it:

```bash
git tag v1.2.3 origin/main
git push origin v1.2.3
```

The release workflow builds and publishes the Chrome ZIP. Get the Firefox ZIP signed by Mozilla and attach the signed `.xpi` to the release afterwards.

## License

[MIT](LICENSE). Bundled third-party libraries in `vendor/` and the CAPTCHA solver keep their own licenses, included alongside them.
