"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AdminTuningApiResponse } from "@/lib/types/api";
import { fetcher } from "@/lib/api";

interface SaveState {
  saving: boolean;
  error: string | null;
  success: string | null;
}

export function TuningPanel() {
  const { data, isLoading, error, mutate } = useSWR<AdminTuningApiResponse>("/admin/tuning", fetcher, {
    refreshInterval: 60_000,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  const settings = data?.settings ?? [];
  const audits = data?.audit ?? [];

  const getDraftValue = (key: string, fallback: unknown): string => {
    if (key in drafts) {
      return drafts[key]!;
    }
    if (fallback === null || fallback === undefined) {
      return "";
    }
    return String(fallback);
  };

  const overridden = settings.filter((setting) => setting.overriddenByEnv).length;
  const summary = {
    total: settings.length,
    overridden,
    editable: settings.length - overridden,
  };

  const saveSetting = async (key: string, valueType: "number" | "string") => {
    const value = drafts[key];
    if (value === undefined) {
      return;
    }

    setSaveState((prev) => ({
      ...prev,
      [key]: {
        saving: true,
        error: null,
        success: null,
      },
    }));

    const bodyValue: unknown = valueType === "number" ? Number(value) : value;
    const response = await fetch("/pulse/api/admin/tuning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        value: bodyValue,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveState((prev) => ({
        ...prev,
        [key]: {
          saving: false,
          error: payload?.error ?? `Save failed (${response.status})`,
          success: null,
        },
      }));
      return;
    }

    setSaveState((prev) => ({
      ...prev,
      [key]: {
        saving: false,
        error: null,
        success: "Saved",
      },
    }));
    await mutate();
  };

  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
        Loading tuning settings...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        Failed to load tuning settings: {error instanceof Error ? error.message : "unknown error"}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Total Settings</p>
          <p className="mt-1 font-mono text-xl">{summary.total}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Editable</p>
          <p className="mt-1 font-mono text-xl text-emerald-300">{summary.editable}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Env Overrides</p>
          <p className="mt-1 font-mono text-xl text-amber-300">{summary.overridden}</p>
        </article>
      </section>

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Runtime settings</h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Environment variables override DB values. Save only updates DB baseline.
        </p>

        <div className="mt-3 space-y-3">
          {settings.map((setting) => {
            const key = setting.key;
            const rowState = saveState[key];
            return (
              <article key={key} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{setting.key}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{setting.description}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">env: {setting.envKey}</p>
                  </div>
                  {setting.overriddenByEnv ? (
                    <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                      env override
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    value={getDraftValue(key, setting.value)}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                    }
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    aria-label={`Setting value for ${key}`}
                  />
                  <button
                    type="button"
                    onClick={() => void saveSetting(key, setting.valueType)}
                    disabled={rowState?.saving}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Save setting ${key}`}
                  >
                    {rowState?.saving ? "Saving..." : "Save"}
                  </button>
                </div>

                <div className="mt-2 grid gap-1 text-[11px] text-[var(--text-tertiary)] md:grid-cols-2">
                  <span>db: {setting.value === null ? "-" : String(setting.value)}</span>
                  <span>effective: {setting.effectiveValue === null ? "-" : String(setting.effectiveValue)}</span>
                  <span>updated: {setting.updatedAt ?? "-"}</span>
                </div>
                {rowState?.error ? <p className="mt-1 text-xs text-red-300">{rowState.error}</p> : null}
                {rowState?.success ? <p className="mt-1 text-xs text-emerald-300">{rowState.success}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent audit logs</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-tertiary)]">
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Key</th>
                <th className="px-2 py-2">Before</th>
                <th className="px-2 py-2">After</th>
                <th className="px-2 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]/60">
                  <td className="px-2 py-2 font-mono">{row.changedAt}</td>
                  <td className="px-2 py-2 font-mono">{row.key}</td>
                  <td className="max-w-[240px] truncate px-2 py-2">{JSON.stringify(row.before)}</td>
                  <td className="max-w-[240px] truncate px-2 py-2">{JSON.stringify(row.after)}</td>
                  <td className="px-2 py-2">{row.changedBy}</td>
                </tr>
              ))}
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-[var(--text-secondary)]">
                    No audit logs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
