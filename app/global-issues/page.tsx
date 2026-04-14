"use client";

import { GlobalIssuePanel } from "@/components/dashboard/GlobalIssuePanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";

export default function GlobalIssuesPage() {
  const { data, isLoading, error } = useGlobalTopics(20);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-lg font-semibold">Global Issues</h1>

      {isLoading && <LoadingSkeleton className="mb-4 h-24" />}

      {error && (
        <EmptyState
          title="\uAE00\uB85C\uBC8C \uC774\uC288\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
          description="\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."
          className="mb-4"
        />
      )}

      {!isLoading && !error && <GlobalIssuePanel topics={data?.globalTopics ?? []} />}
    </main>
  );
}
