import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  display: "swap",
  fallback: ["sans-serif"],
});

export const metadata: Metadata = {
  title: "KIG Marketing CRM",
  description: "Internal Marketing task-management CRM for KIG Holding.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={quicksand.variable} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
