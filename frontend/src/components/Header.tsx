import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import AboutDropdown from "./AboutDropdown";

export default function Header() {
  return (
    <header className="border-b border-line">
      {/* Padding is half the gutter a max-w-5xl centered container would
          leave on each side — i.e. the logo/toggle sit halfway between the
          body content's edge and the actual edge of the page, not flush
          with either. Falls back to a flat 1.5rem on narrow viewports. */}
      <div className="relative flex items-center justify-between px-[max(1.5rem,calc((100%_-_64rem)/4))] py-4">
        <a href="https://www.gunbarrelstudio.com" className="flex items-center gap-2.5">
          <Image src="/logo/gbs-mark.png" alt="Gunbarrel Studio" width={28} height={17} className="logo-mark" priority />
          <span className="text-lg font-bold tracking-tight text-ink">GBS</span>
        </a>

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-ink-muted transition-colors hover:text-ink">
            Prioritize Exposures
          </Link>
          <AboutDropdown />
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
