import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, IconPill } from "@/components/mocks";
import { SiteHeader } from "@/components/site-header";
import { REPO_URL } from "@/lib/release";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

// Shown for any address the site doesn't have.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-24 pb-16 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <h1 className="display text-[clamp(5rem,22vw,10rem)] leading-none">
            4<IconPill tone="sun">?</IconPill>4
          </h1>
          <p className="display mt-6 text-2xl sm:text-3xl">This page isn&apos;t on the menu.</p>
          <p className="mt-3 max-w-sm text-sm text-muted sm:text-[15px]">
            The link may be old or mistyped. On VTOP, <strong className="font-medium text-ink">⌘K</strong> (Ctrl+K)
            takes you anywhere; here, these will:
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <Link href="/whats-new" className="btn btn-default">
              <span className="btn-face">What&apos;s new</span>
            </Link>
            <Link href="/" className="btn btn-confirm">
              <span className="btn-face">
                Back to home <Arrow />
              </span>
            </Link>
          </div>
          <p className="mt-8 text-xs text-muted">
            Something should be here?{" "}
            <a href={`${REPO_URL}/issues`} className="font-medium text-accent hover:underline">
              Report it on GitHub
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
