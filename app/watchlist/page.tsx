import { EmptyState } from "@/components/shared/EmptyState";

export default function WatchlistPage() {
  return (
    <main className="page-shell">
      <section>
        <h1 className="section-title">WATCHLIST</h1>
      </section>
      <section className="card-panel p-5">
        <EmptyState title="워치리스트 준비 중" description="다음 단계에서 관심 토픽 알림 화면을 연결합니다." />
      </section>
    </main>
  );
}
