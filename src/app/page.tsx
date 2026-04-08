"use client";
import dynamic from "next/dynamic";

const HandTracker = dynamic(() => import("./HandTracker"), {
  ssr: false,
});

export default function Page() {
  return <HandTracker />;
}
