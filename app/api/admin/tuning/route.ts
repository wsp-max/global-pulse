import { NextResponse } from "next/server";
import { getPostgresPoolOrNull } from "../../_shared/postgres-server";
import { withApiRequestLog } from "../../_shared/route-logger";
import {
  TUNING_DEFINITIONS,
  TUNING_DEFINITION_BY_KEY,
  isAdminTuningEnabled,
  normalizeTuningInput,
  readEffectiveSetting,
} from "@/lib/admin/tuning";

interface AppSettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

interface AppSettingAuditRow {
  id: number;
  key: string;
  before: unknown;
  after: unknown;
  changed_by: string | null;
  changed_at: string;
}

function buildForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Admin tuning is disabled.",
      enabled: false,
    },
    { status: 403 },
  );
}

async function loadSettings() {
  if (!isAdminTuningEnabled()) {
    return buildForbiddenResponse();
  }

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json(
      {
        error: "PostgreSQL not configured",
        enabled: true,
      },
      { status: 503 },
    );
  }

  const [settingsResult, auditResult] = await Promise.all([
    postgres.query<AppSettingRow>(
      `
      select key, value, updated_at
      from app_settings
      where key = any($1::text[])
      order by key asc
      `,
      [TUNING_DEFINITIONS.map((item) => item.key)],
    ),
    postgres.query<AppSettingAuditRow>(
      `
      select id, key, before, after, changed_by, changed_at
      from app_settings_audit
      where key = any($1::text[])
      order by changed_at desc
      limit 40
      `,
      [TUNING_DEFINITIONS.map((item) => item.key)],
    ),
  ]);

  const byKey = new Map<string, AppSettingRow>(settingsResult.rows.map((row) => [row.key, row]));
  const settings = TUNING_DEFINITIONS.map((definition) => {
    const row = byKey.get(definition.key);
    const dbValue = row?.value ?? null;
    const { effectiveValue, overriddenByEnv } = readEffectiveSetting(definition, dbValue);
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      valueType: definition.valueType,
      envKey: definition.envKey,
      value: dbValue,
      effectiveValue,
      overriddenByEnv,
      updatedAt: row?.updated_at ?? null,
    };
  });

  const audit = auditResult.rows.map((row) => ({
    id: row.id,
    key: row.key,
    before: row.before,
    after: row.after,
    changedBy: row.changed_by ?? "unknown",
    changedAt: row.changed_at,
  }));

  return NextResponse.json({
    enabled: true,
    settings,
    audit,
    lastUpdated: new Date().toISOString(),
  });
}

async function updateSetting(request: Request) {
  if (!isAdminTuningEnabled()) {
    return buildForbiddenResponse();
  }

  const postgres = getPostgresPoolOrNull();
  if (!postgres) {
    return NextResponse.json(
      {
        error: "PostgreSQL not configured",
        enabled: true,
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        key?: string;
        value?: unknown;
        actor?: string;
      }
    | null;

  const key = body?.key?.trim();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const definition = TUNING_DEFINITION_BY_KEY.get(key);
  if (!definition) {
    return NextResponse.json({ error: `unknown setting key: ${key}` }, { status: 400 });
  }

  const normalizedValue = normalizeTuningInput(definition.valueType, body?.value);
  if (normalizedValue === null) {
    return NextResponse.json({ error: `invalid value for ${key}` }, { status: 400 });
  }

  const actor =
    body?.actor?.trim() ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "admin-ui";

  const beforeResult = await postgres.query<AppSettingRow>(
    `
    select key, value, updated_at
    from app_settings
    where key = $1
    limit 1
    `,
    [key],
  );
  const beforeValue = beforeResult.rows[0]?.value ?? null;

  const upsertResult = await postgres.query<AppSettingRow>(
    `
    insert into app_settings (key, value, updated_at)
    values ($1, $2::jsonb, now())
    on conflict (key)
    do update
      set value = excluded.value,
          updated_at = now()
    returning key, value, updated_at
    `,
    [key, JSON.stringify(normalizedValue)],
  );
  const afterValue = upsertResult.rows[0]?.value ?? normalizedValue;

  await postgres.query(
    `
    insert into app_settings_audit (key, before, after, changed_by, changed_at)
    values ($1, $2::jsonb, $3::jsonb, $4, now())
    `,
    [key, JSON.stringify(beforeValue), JSON.stringify(afterValue), actor],
  );

  return NextResponse.json({
    ok: true,
    key,
    value: afterValue,
    changedBy: actor,
    updatedAt: upsertResult.rows[0]?.updated_at ?? new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return withApiRequestLog(request, "/api/admin/tuning", loadSettings);
}

export async function POST(request: Request) {
  return withApiRequestLog(request, "/api/admin/tuning", () => updateSetting(request));
}

