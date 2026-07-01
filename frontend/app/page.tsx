"use client";
// app/page.tsx
// Thin wrapper — keeps genlayer-js out of SSR.
// All logic lives in App.tsx which is never server-rendered.

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), { ssr: false });

export default function Page() {
  return <App />;
}
