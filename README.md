# VTOP Command

A browser extension for VIT's VTOP portal. It adds a ⌘K / Ctrl+K command menu, a dark mode, and helpers for attendance, assignments, marks and CGPA.

It runs only on `vtop.vit.ac.in/vtop/`, talks to no other server, and never submits anything on your behalf.

## Install

Download the files from the [latest release](https://github.com/ChirayuSahu/vtop-cmd/releases/latest).

**Firefox / Zen**

1. Download `vtop-command-<version>.xpi`.
2. Open `about:addons`, click the gear icon and choose **Install Add-on From File…**.
3. Select the file and confirm.

**Chrome / Brave**

1. Download `vtop-command-<version>.zip` and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Features

- **Command menu:** press ⌘K / Ctrl+K on any VTOP page to search and open any page, with aliases (`DA`, `CGPA`, `marks`) and typo-tolerant matching.
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

```bash
npm ci
npm run check   # syntax check
npm test        # unit and DOM tests
npm run build   # Chrome and Firefox packages in dist/
npm run source  # source archive for Firefox Add-ons review
```

To try a local build, load `dist/vtop-command/` in Chrome (**Load unpacked**) or `dist/vtop-command-firefox/manifest.json` in Firefox (`about:debugging` → **Load Temporary Add-on…**).

The homepage is a separate Next.js app in `website/`: run `npm ci && npm run dev` there.

Tests use made-up data shaped like VTOP's markup; no account data is included.

### Releases

Pull requests must pass CI (checks, tests, both builds and `web-ext lint`) before merging into `main`. To release, bump the version in `manifest.json` and `package.json`, merge to `main`, then tag it:

```bash
git tag v1.2.1 origin/main
git push origin v1.2.1
```

The release workflow builds and publishes the Chrome ZIP. Get the Firefox ZIP signed by Mozilla and attach the signed `.xpi` to the release afterwards.
