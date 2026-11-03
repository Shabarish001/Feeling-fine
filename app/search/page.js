import { Suspense } from "react";
import SearchView from "@/components/SearchView";

// PAGE 2 — Results: the conversation on the left, the map on the right.
export const metadata = { title: "Results — FEELING FINE" };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
