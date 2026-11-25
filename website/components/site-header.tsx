import Link from "next/link";
import { Logo } from "@/components/mocks";
import { REPO_URL } from "@/lib/release";

// The floating navbar on every page. On the home page its links scroll in place; elsewhere they
// lead back to the same sections of the home page. Anything passed in (the release banner) sits below it.
export function SiteHeader({
  home = false,
  children,
}: {
  home?: boolean;
  children?: React.ReactNode;
}) {
  const section = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <div className="fixed inset-x-0 top-3 z-50 px-3">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl bg-ink/95 py-2 pr-2 pl-4 text-white shadow-lg backdrop-blur"
      >
        <Link
          href={home ? "#" : "/"}
          aria-label={home ? "VTOP Command, back to top" : "VTOP Command home"}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Logo size={22} />
          VTOP Command
        </Link>
        <div className="hidden items-center gap-7 text-[13px] text-white/70 md:flex">
          <Link
            href={section("features")}
            className="transition-colors hover:text-white"
          >
            Features
          </Link>
          <Link
            href={section("safety")}
            className="transition-colors hover:text-white"
          >
            Safety
          </Link>
          <Link
            href={section("install")}
            className="transition-colors hover:text-white"
          >
            Install
          </Link>
          <a href={REPO_URL} className="transition-colors hover:text-white">
            GitHub
          </a>
        </div>
        <Link
          href={section("download")}
          className="btn btn-default btn-compact text-[13px]"
        >
          <span className="btn-face h-[30px] px-4">Download</span>
        </Link>
      </nav>
      {children}
    </div>
  );
}
