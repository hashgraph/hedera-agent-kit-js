import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { readEnv } from "@/features/chat-hedera/server";
import { AppProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Hedera Agent Chat",
  description: "Chat with a Hedera agent scaffolded by create-hedera-agent.",
};

export default function RootLayout({ children }) {
  // Read the operator key server-side and pass it to the browser-side wallet
  // simulator. The key is intentionally serialized into the initial HTML.
  // That's the "simulation" part. A real wallet holds its own key and the
  // server never sees it; swapping <ChatWalletProvider> for a wallet SDK is
  // the upgrade path.
  const { operatorId, operatorKey } = readEnv();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders accountId={operatorId} signingKey={operatorKey}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
