import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/mocks";
import { getReleaseNotes, REPO_URL } from "@/lib/release";

export const metadata: Metadata = {
  title: "What's new",
  description: "What changed in the latest version of the VTOP Command extension.",
  alternates: { canonical: "/whats-new" },
};

type Search = Promise<{ v?: string | string[] }>;

// The extension opens /whats-new?v=<version> once after it updates. The header renders at once;
// the notes stream in after the release lookup.
export default function WhatsNewPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
        <Logo size={22} /> VTOP Command
      </Link>
      <Suspense fallback={<h1 className="display mt-10 text-4xl text-muted sm:text-5xl">What&apos;s new</h1>}>
        <Notes searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Notes({ searchParams }: { searchParams: Search }) {
  const { v } = await searchParams;
  const requested = typeof v === "string" ? v : undefined;
  const notes = (requested ? await getReleaseNotes(requested) : null) ?? (await getReleaseNotes());
  const updated = !!requested && notes?.version === requested;
  const date = notes?.publishedAt
    ? new Date(notes.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      <p className="mt-10 text-sm font-medium text-accent">{updated ? "You're up to date" : "Latest release"}</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">
        {notes ? `What's new in ${notes.version}` : "What's new"}
      </h1>
      {date && <p className="mt-3 text-sm text-muted">Released {date}</p>}

      {notes ? (
        <div className="release-notes mt-10" dangerouslySetInnerHTML={{ __html: notes.html }} />
      ) : (
        <p className="mt-10 text-[15px] text-ink/85">The release notes couldn&apos;t be loaded right now.</p>
      )}

      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
        <a href={notes?.url ?? `${REPO_URL}/releases/latest`} className="font-medium text-accent hover:underline">
          Release notes on GitHub
        </a>
        <a href={`${REPO_URL}/releases`} className="font-medium text-accent hover:underline">
          All releases
        </a>
        <a href="https://vtop.vit.ac.in/vtop/content" className="font-medium text-accent hover:underline">
          Back to VTOP
        </a>
      </div>
    </>
  );
}
