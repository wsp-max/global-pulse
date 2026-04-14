"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-6">
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
        <p className="text-sm font-semibold text-red-200">페이지 처리 중 오류가 발생했습니다.</p>
        <p className="mt-2 text-xs text-red-300">{error.message || "Unknown error"}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-md border border-red-700/60 bg-red-900/40 px-3 py-2 text-xs text-red-100 transition hover:bg-red-900/60"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}

