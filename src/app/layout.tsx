import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LinguaLearn AI – Breaking Language Barriers in Education",
  description:
    "Translate, listen, and practice your study material in any language. Inclusive learning powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        {/* Simple top navigation */}
        <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="text-sm font-semibold">
              LinguaLearn AI
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/app" className="text-muted-foreground hover:text-foreground">Workspace</Link>
              <Link href="/practice" className="text-muted-foreground hover:text-foreground">Practice</Link>
            </nav>
          </div>
        </header>
        {children}
        <VisualEditsMessenger />
      </body>
    </html>
  );
}