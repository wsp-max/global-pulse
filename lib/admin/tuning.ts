export type TuningValueType = "number" | "string";

export interface TuningDefinition {
  key: string;
  label: string;
  description: string;
  valueType: TuningValueType;
  envKey: string;
}

export const TUNING_DEFINITIONS: TuningDefinition[] = [
  {
    key: "ANALYZER_MAX_TOPICS",
    label: "Max Topics",
    description: "Maximum topics per analysis batch.",
    valueType: "number",
    envKey: "ANALYZER_MAX_TOPICS",
  },
  {
    key: "ANALYZER_SIMILARITY_THRESHOLD",
    label: "Similarity Threshold",
    description: "Cross-region similarity threshold.",
    valueType: "number",
    envKey: "ANALYZER_SIMILARITY_THRESHOLD",
  },
  {
    key: "ANALYZER_MIN_ANOMALY_Z",
    label: "Min Anomaly Z",
    description: "Minimum z-score for anomaly highlighting.",
    valueType: "number",
    envKey: "ANALYZER_MIN_ANOMALY_Z",
  },
  {
    key: "ANALYZER_PROPAGATION_LAG_WINDOW_HOURS",
    label: "Lag Window Hours",
    description: "Max lag window used by propagation view.",
    valueType: "number",
    envKey: "ANALYZER_PROPAGATION_LAG_WINDOW_HOURS",
  },
  {
    key: "GEMINI_MODEL_PRIMARY",
    label: "Gemini Primary",
    description: "Primary Gemini model for summaries.",
    valueType: "string",
    envKey: "GEMINI_MODEL_PRIMARY",
  },
  {
    key: "GEMINI_MODEL_FALLBACK",
    label: "Gemini Fallback",
    description: "Fallback Gemini model when primary fails.",
    valueType: "string",
    envKey: "GEMINI_MODEL_FALLBACK",
  },
];

export const TUNING_DEFINITION_BY_KEY = new Map<string, TuningDefinition>(
  TUNING_DEFINITIONS.map((item) => [item.key, item]),
);

export function isAdminTuningEnabled(): boolean {
  return process.env.FEATURE_ADMIN_TUNING === "true" || process.env.ADMIN_TUNING_ENABLED === "true";
}

export function normalizeTuningInput(valueType: TuningValueType, rawValue: unknown): number | string | null {
  if (valueType === "number") {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  if (rawValue === null || rawValue === undefined) {
    return "";
  }

  return String(rawValue);
}

export function readEffectiveSetting(definition: TuningDefinition, dbValue: unknown): {
  effectiveValue: unknown;
  overriddenByEnv: boolean;
} {
  const envValue = process.env[definition.envKey];
  if (envValue !== undefined && envValue !== null && envValue !== "") {
    if (definition.valueType === "number") {
      const parsed = Number(envValue);
      if (Number.isFinite(parsed)) {
        return {
          effectiveValue: parsed,
          overriddenByEnv: true,
        };
      }
    } else {
      return {
        effectiveValue: envValue,
        overriddenByEnv: true,
      };
    }
  }

  return {
    effectiveValue: dbValue,
    overriddenByEnv: false,
  };
}

