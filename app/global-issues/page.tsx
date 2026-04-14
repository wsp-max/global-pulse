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
          title="글로벌 이슈를 불러오지 못했습니다."
          description="잠시 후 다시 시도해 주세요."
          className="mb-4"
        />
      )}

      {!error && <GlobalIssuePanel topics={data?.globalTopics ?? []} />}
    </main>
  );
}

