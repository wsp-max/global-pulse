"use client";

import { GlobalIssuePanel } from "@/components/dashboard/GlobalIssuePanel";
import { useGlobalTopics } from "@/lib/hooks/useGlobalTopics";

export default function GlobalIssuesPage() {
  const { data, isLoading } = useGlobalTopics(20);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-lg font-semibold">Global Issues</h1>
      {isLoading && (
        <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
          글로벌 이슈 로딩 중...
        </div>
      )}
      <GlobalIssuePanel topics={data?.globalTopics ?? []} />
    </main>
  );
}
