import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/mocks";
import { REPO_URL } from "@/lib/release";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What the VTOP Command extension stores, where it stays, and what it never does.",
  alternates: { canonical: "/privacy" },
};

const stored = [
  ["Theme, default semester and known semester names", "Your device (extension storage)", "Until you change them or remove the extension"],
  ["Command-menu shortcut and usage ranking (page IDs, counts, last-used times)", "Your device (extension storage)", "Until you reset them or remove the extension"],
  ["Form presets you create (your usual answers for a form)", "Your device (extension storage)", "Until you delete the preset or remove the extension"],
  ["CGPA grade predictions, saved under your registration number", "Your device (extension storage)", "Until you change them or remove the extension"],
  ["Pending-assignment titles and due dates, keyed by your signed-in student ID", "Your device, in memory-only session storage", "1–5 hours, an upload on that course, or closing the browser"],
  ["CAPTCHA autofill on/off setting", "Your device (extension storage)", "Until you change it or remove the extension"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
        <Logo size={22} /> VTOP Command
      </Link>

      <h1 className="display mt-10 text-4xl sm:text-5xl">Privacy policy</h1>
      <p className="mt-3 text-sm text-muted">Effective 3 November 2026</p>

      <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-ink/85">
        <section>
          <p>
            VTOP Command is a free, unofficial browser extension for VIT&apos;s VTOP student portal. It is a student
            project and is not affiliated with VIT. This policy covers the extension for Chrome, Brave and Firefox.
          </p>
          <p className="mt-4 font-medium text-ink">
            In short: the extension does not collect, sell or share your data. Everything it saves stays in your
            browser, and the only server it talks to is VTOP itself.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl">Where it runs</h2>
          <p className="mt-3">
            The extension only runs on <code className="font-mono text-sm">https://vtop.vit.ac.in/vtop/</code>. It reads
            the VTOP pages you open, such as your timetable, attendance, marks and assignments, so it can add its
            features to them. That reading happens inside your browser.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl">What it sends, and to whom</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Only requests that VTOP&apos;s own menus and buttons already make (for example opening a page or loading a
              course&apos;s assignment dashboard), sent to VTOP with your existing sign-in.
            </li>
            <li>No data is sent to the developers or to any other server. There are no analytics, ads or trackers in the extension.</li>
            <li>No remote code is loaded; everything the extension runs is included in the package you install.</li>
          </ul>
        </section>

        <section>
          <h2 className="display text-2xl">What it stores on your device</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-soft text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Where</th>
                  <th className="px-4 py-3 font-medium">Kept until</th>
                </tr>
              </thead>
              <tbody>
                {stored.map(([data, where, until]) => (
                  <tr key={data} className="border-t border-line align-top">
                    <td className="px-4 py-3">{data}</td>
                    <td className="px-4 py-3 text-muted">{where}</td>
                    <td className="px-4 py-3 text-muted">{until}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            The extension never stores your password, your marks history or your attendance. Removing the extension
            deletes everything it saved.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl">CAPTCHA autofill and documents</h2>
          <p className="mt-3">
            The VTOP login CAPTCHA image is read by a small model bundled with the extension, on your device. PDF,
            Word and PowerPoint files from VTOP are shown in a viewer that is also part of the extension. Neither the
            image nor your documents leave your browser.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl">What it never does</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Submit forms, upload files, register, apply, pay or give feedback on your behalf.</li>
            <li>Sign in for you or keep you signed in.</li>
            <li>Sell, transfer or use your data for anything other than the features described here.</li>
          </ul>
        </section>

        <section>
          <h2 className="display text-2xl">This website</h2>
          <p className="mt-3">
            This website (not the extension) uses Vercel Web Analytics to count page views. It does not use cookies and
            does not identify you.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl">Changes and contact</h2>
          <p className="mt-3">
            If this policy changes, the new version will be posted here with a new date. Questions or concerns are
            welcome as an{" "}
            <a href={`${REPO_URL}/issues`} className="font-medium text-accent hover:underline">
              issue on GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
