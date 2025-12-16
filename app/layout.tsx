import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { McpProvider } from "@/contexts/mcp-context";
import { ChatProvider } from "@/contexts/chat-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SORANGSU - AI Chat",
  description: "AI Chat with MCP Server Integration",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <McpProvider>
          <ChatProvider>{children}</ChatProvider>
        </McpProvider>
      </body>
    </html>
  );
}
