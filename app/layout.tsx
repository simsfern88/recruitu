import type { Metadata } from "next";
import { Open_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// One institutional sans for both display and body — headings differ by
// weight, not by typeface, matching the MyCareer/campus-portal identity
// this UI now sits inside.
const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});
// Named --font-mono-raw (not --font-mono) so it can't collide with the
// --font-mono alias in globals.css — see the note there for why that
// collision silently broke every font-family on the page.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono-raw",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "RecruitU",
  description: "Organize, tailor, and prepare your whole job hunt in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Font variable classes live on <html> (the element :root matches), not
    // <body> — a CSS custom property's var() references resolve using the
    // environment of the element the DECLARING rule matches, not the
    // element that finally consumes it. globals.css's :root block aliases
    // these into --font-display/--font-body/--font-mono, so the raw
    // variables have to be visible at :root itself or that indirection
    // resolves to nothing.
    <html lang="en" className={`${openSans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
