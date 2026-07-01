import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CommitChain — Your word, on-chain. Forever.",
  description:
    "Lock your commitments on-chain before you're tempted to change them. AI judges whether you kept your word. Your record is permanent and public.",
  openGraph: {
    title: "CommitChain",
    description:
      "Your word, on-chain. Forever. Lock commitments, submit proof, get an impartial AI verdict.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
