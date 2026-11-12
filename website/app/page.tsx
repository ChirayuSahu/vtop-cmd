import { AttendanceCard, ShortcutKeys, TypingMenu } from "@/components/live-cards";
import { Arrow, B, IconPill, Logo } from "@/components/mocks";
import { OnDevice, RequestQueue, YouSubmit } from "@/components/safety";
import { FeatureShowcase } from "@/components/showcase";
import { CountUp, Reveal, RevealText } from "@/components/motion";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLatestRelease, REPO_URL } from "@/lib/release";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

const safety = [
  { title: "Never acts for you", body: <>It can fill a form, but it <B>never submits</B>, uploads, registers, applies or pays. You do.</>, art: <YouSubmit /> },
  { title: "Gentle on VTOP", body: <>Only VTOP&apos;s own requests, sent <B>one at a time</B>, with results cached so they aren&apos;t asked twice.</>, art: <RequestQueue /> },
  { title: "Stays on your device", body: <><B>No analytics, no trackers, no other servers.</B> Your password is never seen or stored.</>, art: <OnDevice /> },
];

const ticker = ["dark mode", "CGPA", "attendance", "marks totals", "deadlines", "documents", "⌘K search"];

function Button({ href, children, tone = "accent" }: { href: string; children: React.ReactNode; tone?: "accent" | "soft" | "white" }) {
  const tones = { accent: "btn-confirm", soft: "btn-default", white: "btn-default" };
  return (
    <a href={href} className={`btn ${tones[tone]}`}>
      <span className="btn-face">{children}</span>
    </a>
  );
}

function Downloads({ chromeUrl, firefoxUrl }: { chromeUrl: string; firefoxUrl: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      <Button href={firefoxUrl} tone="soft">
        Get it for Firefox
      </Button>
      <Button href={chromeUrl}>
        Download for Chrome <Arrow />
      </Button>
    </div>
  );
}

// Rendered on the server for every request. The release lookup inside stays cached for an hour,
// so visits don't each call GitHub.
export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

// Tells search engines this is a free browser extension, with its download links.
function StructuredData({ version, chromeUrl, firefoxUrl }: { version: string | null; chromeUrl: string; firefoxUrl: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: siteUrl().href,
    applicationCategory: "BrowserApplication",
    operatingSystem: "Chrome, Brave, Firefox, Zen",
    ...(version ? { softwareVersion: version } : {}),
    downloadUrl: [chromeUrl, firefoxUrl],
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    sameAs: [REPO_URL],
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inline; "<" is escaped so the data can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

async function Home() {
  await connection();
  const { version, chromeUrl, firefoxUrl, xpiUrl } = await getLatestRelease();

  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <StructuredData version={version} chromeUrl={chromeUrl} firefoxUrl={firefoxUrl} />
      <div className="fixed inset-x-0 top-3 z-50 px-3">
        <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl bg-ink/95 py-2 pr-2 pl-4 text-white shadow-lg backdrop-blur">
          <a href="#" aria-label="VTOP Command, back to top" className="flex items-center gap-2 text-sm font-semibold">
            <Logo size={22} />
            VTOP Command
          </a>
          <div className="hidden items-center gap-7 text-[13px] text-white/70 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#safety" className="transition-colors hover:text-white">Safety</a>
            <a href="#install" className="transition-colors hover:text-white">Install</a>
            <a href={REPO_URL} className="transition-colors hover:text-white">GitHub</a>
          </div>
          <a href="#download" className="btn btn-default btn-compact text-[13px]">
            <span className="btn-face h-[30px] px-4">Download</span>
          </a>
        </nav>
        <a
          href={`${REPO_URL}/releases/tag/v1.2.5`}
          className="mx-auto mt-2 flex max-w-7xl items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-accent/95 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span>Version 1.2.5 is live</span>
          <span>Release notes <span aria-hidden="true">↗</span></span>
        </a>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex min-h-svh max-w-7xl flex-col items-center justify-center px-4 pt-32 pb-16 text-center sm:px-6">
          {/* Phones: four balanced lines (Tired of / the old and / slow VTOP? / Fix it.); wider screens: three. */}
          <h1 className="display text-[min(calc((100vw-2rem)/5.3),4.75rem)] sm:text-[clamp(3rem,9.5vw,7.25rem)]">
            <RevealText className="block">
              <IconPill tone="accent">⌘K</IconPill> Tired of
            </RevealText>
            <RevealText delay={260} className="inline sm:block">
              the old <span className="text-muted/60">and</span>
              <br className="sm:hidden" /> slow
            </RevealText>{" "}
            <RevealText delay={620} className="inline whitespace-nowrap sm:block">
              VTOP? <br className="sm:hidden" />
              <IconPill tone="sun">↑</IconPill> Fix it.
            </RevealText>
          </h1>
          <Reveal delay={400} className="mt-10 flex flex-col items-center gap-8">
            <p className="max-w-md text-sm leading-relaxed text-muted sm:text-[15px]">
              VTOP Command is a <B>free browser extension</B> that adds a <B>⌘K menu</B>, a <B>real dark mode</B> and the
              helpers VIT never built, right inside the portal you already use.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Downloads chromeUrl={chromeUrl} firefoxUrl={firefoxUrl} />
              <span className="text-xs text-muted">
                Free &amp; open source · Runs only on vtop.vit.ac.in
              </span>
            </div>
          </Reveal>
        </section>

        {/* Key benefits */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-32 px-4 sm:px-6">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="display max-w-md text-3xl sm:text-4xl">
              <RevealText>Your key to a faster, calmer VTOP</RevealText>
            </h2>
            <p className="max-w-xs text-sm text-muted">
              Every class, deadline and grade, <B>a shortcut away</B>. No new app, no new login.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_1fr_0.9fr]">
            <Reveal className="rounded-3xl border border-line bg-white p-6 transition-colors duration-300 hover:border-ink/20">
              <span className="rounded-full bg-sun px-2.5 py-1 text-[11px] font-medium">Command menu</span>
              <h3 className="mt-5 text-lg font-medium">Fast and easy access to every page</h3>
              <p className="mt-2 text-sm text-muted">
                Search VTOP&apos;s <B>whole menu</B>, including collapsed sections, with aliases like <B>DA</B> and <B>CGPA</B>.
              </p>
              <div className="mt-6">
                <TypingMenu />
              </div>
            </Reveal>
            <Reveal delay={120} className="rounded-3xl border border-line bg-white p-6 transition-colors duration-300 hover:border-ink/20">
              <AttendanceCard />
            </Reveal>
            <Reveal delay={240} className="flex flex-col justify-between gap-10 rounded-3xl bg-ink p-6 text-white">
              <div className="flex items-center justify-between">
                <Logo size={36} />
                <span className="pulse size-2.5 rounded-full bg-accent" />
              </div>
              <ShortcutKeys />
            </Reveal>
          </div>
          <Reveal className="mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-16 sm:text-left">
            <div className="flex items-end gap-3">
              <span className="pb-3 text-sm text-muted">Sends</span>
              <span className="display text-7xl sm:text-8xl">
                <CountUp to={0} />
              </span>
            </div>
            <p className="max-w-sm text-sm text-muted sm:pb-3">
              requests to anything other than VTOP. <B>No analytics, no tracking, no remote code</B>: everything runs on
              your device.
            </p>
          </Reveal>
        </section>

        {/* Everything VTOP should have had */}
        <section className="mx-auto mt-32 max-w-7xl px-4 text-center sm:px-6 sm:text-left">
          <h2 className="display text-[clamp(2.4rem,6.5vw,5rem)]">
            <RevealText className="block">
              Everything <span className="text-muted/60">VTOP</span>
            </RevealText>
            <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
              <RevealText delay={300}>should have had,</RevealText>
              <Reveal as="span" delay={750}>
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pr-4 pl-1.5 text-base font-semibold tracking-normal shadow-sm sm:text-lg">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm text-white">+</span>
                  6 tools
                </span>
              </Reveal>
            </span>
            <Reveal as="span" delay={900} className="mt-5 block">
              <span className="parallax-x-reverse relative inline-flex w-[min(100%,11em)] overflow-hidden rounded-full bg-sun py-[0.08em]">
                <span className="slide flex shrink-0 gap-[0.6em] whitespace-nowrap pl-[0.4em]">
                  {[...ticker, ...ticker].map((word, index) => (
                    <span key={index}>{word} ·</span>
                  ))}
                </span>
              </span>
            </Reveal>
          </h2>
          <Reveal className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <p className="max-w-md text-sm text-muted">
              Attendance maths, pending deadlines, marks totals, a CGPA projector and a document viewer,{" "}
              <B>built into the pages where you need them</B>.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button href={REPO_URL} tone="soft">
                View source
              </Button>
              <Button href="#download">
                Get it free <Arrow />
              </Button>
            </div>
          </Reveal>
        </section>

        {/* Feature list with product scenes */}
        <section className="mx-auto mt-32 max-w-7xl px-4 sm:px-6">
          <Reveal>
            <FeatureShowcase
              heading={
                <h2 className="display text-3xl sm:text-4xl">
                  <RevealText>Turning VTOP into a portal you&apos;ll enjoy.</RevealText>
                </h2>
              }
            />
          </Reveal>
        </section>

        {/* Wordmark */}
        <section className="mt-32 overflow-x-clip">
          <div className="parallax-x">
            <RevealText
              as="div"
              className="display text-center text-[12.5vw] leading-[0.9] font-semibold whitespace-nowrap text-accent"
            >
              VTOP Command
            </RevealText>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="mx-auto mt-28 max-w-7xl scroll-mt-32 px-4 sm:px-6">
          <h2 className="display text-[clamp(2.4rem,6vw,4.5rem)]">
            <RevealText className="block">We give you full</RevealText>
            <RevealText delay={380} className="block">
              <span className="text-muted/60">control</span> over your account
            </RevealText>
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {safety.map((card, index) => (
              <Reveal key={card.title} delay={index * 120} className="rounded-3xl bg-soft p-2">
                <div className="h-44 overflow-hidden rounded-[1.25rem] border border-line bg-white">
                  {card.art}
                </div>
                <div className="px-4 pt-5 pb-4">
                  <h3 className="font-medium">{card.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mx-auto mt-32 max-w-7xl scroll-mt-32 px-4 sm:px-6">
          <Reveal>
            <h2 className="display text-3xl sm:text-4xl">
              <RevealText>Install in a minute</RevealText>
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                name: "Firefox & Zen",
                steps: [
                  <>
                    Open VTOP Command on{" "}
                    <a href={firefoxUrl} className="font-medium text-accent hover:underline">
                      Firefox Add-ons
                    </a>
                    .
                  </>,
                  <>
                    Click <B>Add to Firefox</B> and confirm.
                  </>,
                  <>It updates itself from then on.</>,
                ],
                note: (
                  <>
                    Listing still in review? Install the signed{" "}
                    <a href={xpiUrl} className="font-medium text-accent hover:underline">
                      .xpi file
                    </a>{" "}
                    from <B>about:addons</B> → gear icon → <B>Install Add-on From File</B>.
                  </>
                ),
              },
              {
                name: "Chrome & Brave",
                steps: [
                  <>
                    Download the{" "}
                    <a href={chromeUrl} className="font-medium text-accent hover:underline">
                      .zip file
                    </a>{" "}
                    and unzip it.
                  </>,
                  <>
                    Open <B>chrome://extensions</B> and turn on <B>Developer mode</B>.
                  </>,
                  <>
                    Click <B>Load unpacked</B> and select the unzipped folder.
                  </>,
                ],
                note: null,
              },
            ].map((browser, index) => (
              <Reveal key={browser.name} delay={index * 120} className="rounded-3xl border border-line p-6">
                <h3 className="font-medium">{browser.name}</h3>
                <ol className="mt-4 space-y-3 text-sm text-muted">
                  {browser.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft text-xs text-ink">
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {browser.note && <p className="mt-4 border-t border-line pt-4 text-xs text-muted">{browser.note}</p>}
              </Reveal>
            ))}
          </div>
        </section>

        {/* Get started */}
        <section id="download" className="mx-auto mt-32 max-w-3xl scroll-mt-32 px-4 pb-28 text-center sm:px-6">
          <Reveal>
            <div className="pulse mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent">
              <Logo size={40} />
            </div>
            <h2 className="display mt-8 text-5xl sm:text-6xl">
              <RevealText>Get started</RevealText>
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-sm text-muted">
              Free, open source and <B>installed in a minute</B>. Your VTOP, finally pleasant to use.
            </p>
            <div className="mt-8 flex justify-center">
              <Downloads chromeUrl={chromeUrl} firefoxUrl={firefoxUrl} />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="mx-3 mb-3 overflow-hidden rounded-3xl bg-ink text-white">
        {/* Phones: one centred column. Laptops: links left, GitHub call to action right. */}
        <div className="mx-auto max-w-7xl px-6 pt-12 pb-8 text-center sm:px-10 sm:pt-14 lg:text-left">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="lg:order-2 lg:text-right">
              <a href={REPO_URL} className="display group inline-flex items-center gap-3 text-3xl sm:text-5xl">
                <RevealText>Star it on GitHub</RevealText>
                <Arrow className="size-6 text-white/60 transition-colors group-hover:text-white sm:size-8" />
              </a>
              <p className="mx-auto mt-3 max-w-sm text-sm text-white/50 lg:mr-0 lg:ml-auto">
                <span className="font-medium text-white">Open to contributions.</span> Bug fixes, new features and typo
                fixes are all welcome.
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 text-sm lg:order-1">
              {[
                {
                  title: "Product",
                  links: [
                    { label: "Features", href: "#features" },
                    { label: "Safety", href: "#safety" },
                    { label: "Install", href: "#install" },
                  ],
                },
                {
                  title: "Project",
                  links: [
                    { label: "Releases", href: `${REPO_URL}/releases` },
                    { label: "Report an issue", href: `${REPO_URL}/issues` },
                    { label: "Source code", href: REPO_URL },
                  ],
                },
              ].map((column) => (
                <div key={column.title}>
                  <div className="text-xs font-medium tracking-wider text-white/40 uppercase">{column.title}</div>
                  <ul className="mt-3 space-y-2">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="text-white/70 transition-colors hover:text-white">
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="my-10 h-px bg-white/15" />

          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 text-left lg:mx-0">
            {[
              { name: "Chrome & Brave", action: "Download the .zip", url: chromeUrl },
              { name: "Firefox & Zen", action: "Get it on Firefox Add-ons", url: firefoxUrl },
            ].map((download) => (
              <a
                key={download.name}
                href={download.url}
                className="rounded-2xl bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <span className="block text-sm font-semibold">{download.name}</span>
                <span className="mt-1 block text-xs text-white/50">
                  {download.action}
                  {version ? ` · v${version}` : ""}
                </span>
              </a>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-5 lg:mt-16 lg:flex-row lg:items-end lg:justify-between">
            <RevealText
              as="div"
              className="display text-[clamp(2.5rem,11vw,4rem)] leading-[0.85] whitespace-nowrap lg:text-[clamp(4rem,6.4vw,6.25rem)]"
            >
              VTOP Command
              <sup data-unit className="ml-1 align-super text-[0.3em] text-white/60">
                ⌘
              </sup>
            </RevealText>
            <div className="flex items-end gap-12">
              <p className="text-xs text-white/40">A student project · Not affiliated with VIT</p>
              <div className="hidden size-20 shrink-0 items-center justify-center rounded-2xl bg-white lg:flex">
                <Logo size={52} />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
