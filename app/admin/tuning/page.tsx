import { TuningPanel } from "@/components/admin/TuningPanel";
import { isAdminTuningEnabled } from "@/lib/admin/tuning";

export const dynamic = "force-dynamic";

export default function AdminTuningPage() {
  if (!isAdminTuningEnabled()) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Admin Tuning</h1>
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Admin tuning is disabled. Set <code>FEATURE_ADMIN_TUNING=true</code> (or{" "}
          <code>ADMIN_TUNING_ENABLED=true</code>) to enable this console.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-[var(--text-accent)]">Admin Tuning</h1>
        <p className="text-xs text-[var(--text-tertiary)]">/pulse/admin/tuning</p>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Runtime tuning values are stored in <code>app_settings</code>. Environment variables always win.
      </p>
      <div className="mt-4">
        <TuningPanel />
      </div>
    </main>
  );
}

