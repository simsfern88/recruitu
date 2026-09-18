"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs/new", label: "Capture a job" },
  { href: "/postings", label: "Job postings" },
  { href: "/onboarding", label: "Profile" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <div className="topbar">
      <div className="shell row between" style={{ height: 60 }}>
        <div className="row" style={{ gap: 24 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="platform-badge">MyCareer</span>
            <span className="platform-divider" />
            <Link href="/dashboard" className="brand" style={{ textDecoration: "none", color: "var(--ink)" }}>
              <span className="brand-dot" />
              Recruit<span>U</span>
            </Link>
          </div>
          <nav className="row" style={{ gap: 4 }}>
            {LINKS.map((l) => (
              <Link
                key={l.href}
                className={pathname === l.href ? "navlink current" : "navlink"}
                href={l.href}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="tag">{email}</span>
          <form action={logout}>
            <button className="btn btn-ghost" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
