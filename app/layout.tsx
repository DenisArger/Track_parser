import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Track Parser - Radio Track Preparation",
  description: "Automated radio track preparation application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure layout is a pure Server Component without any side effects
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Track Parser
            </h1>
            <p className="text-gray-600">
              Automated radio track preparation and management
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
