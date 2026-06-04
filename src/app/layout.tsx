import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockNews — Nifty 100 Live Data & News",
  description: "Live Nifty 100 stock market data, charts, and financial news",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <a href="/" className="text-lg font-bold text-gray-900">
              📈 StockNews
            </a>
            <a
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </a>
            <a
              href="/news"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              News
            </a>
            <a
              href="/stocks"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Stocks
            </a>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
