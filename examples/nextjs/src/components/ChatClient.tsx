"use client";

import dynamic from "next/dynamic";

// Wraps Chat in a dynamic import with ssr: false to prevent "window is not defined"
// errors caused by browser-only APIs (e.g. localStorage, crypto) running during SSR.
const Chat = dynamic(() => import("./Chat"), { ssr: false });

export default function ChatClient() {
    return <Chat />;
}
