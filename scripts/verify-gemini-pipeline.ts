import type { Topic } from "@global-pulse/shared";
import { summarizeTopicsWithGemini } from "../packages/analyzer/src/gemini-summarizer";

const GEMINI_API_BASE = process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim() || "v1beta";
const GEMINI_MODEL_PRIMARY = process.env.GEMINI_MODEL_PRIMARY?.trim() || "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-2.0-flash";
const FALLBACK_SUMMARY_KO = "요약 준비 중";
const FALLBACK_SUMMARY_EN = "Summary pending";

interface SampleCase {
  regionId: string;
  topic: Topic;
}

function buildTopic(regionId: string, nameKo: string, nameEn: string, keywords: string[]): Topic {
  const now = new Date();
  const periodEnd = now.toISOString();
  const periodStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  return {
    regionId,
    nameKo,
    nameEn,
    keywords,
    sampleTitles: [
      `${nameKo} 관련 토론이 빠르게 증가 중`,
      `${nameEn} discussion volume rises across communities`,
    ],
    sentiment: 0,
    heatScore: 320,
    postCount: 24,
    totalViews: 12000,
    totalLikes: 850,
    totalComments: 420,
    sourceIds: ["reddit"],
    periodStart,
    periodEnd,
  };
}

async function probeRawGemini(regionId: string, topic: Topic): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const payload = [{
    index: 0,
    current_name_ko: topic.nameKo,
    current_name_en: topic.nameEn,
    top_titles: (topic.sampleTitles ?? []).slice(0, 2),
    keywords: topic.keywords.slice(0, 6),
    heat_score: topic.heatScore,
    sentiment: topic.sentiment,
  }];

  const prompt = [
    "Return only JSON array with one item.",
    "Fields: name_ko,name_en,summary_ko,summary_en,sentiment,category,entities,aliases",
    "summary_ko and summary_en must each be 2-3 full sentences.",
    `region=${regionId}`,
    JSON.stringify(payload),
  ].join("\n");

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${GEMINI_MODEL_PRIMARY}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 1536,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`raw probe failed HTTP ${response.status} ${raw.slice(0, 300)}`);
  }

  return raw;
}

async function main(): Promise<void> {
  const envStatus = {
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY?.trim()),
    ANALYZER_USE_GEMINI: process.env.ANALYZER_USE_GEMINI ?? "(unset)",
    GEMINI_MODEL_PRIMARY,
    GEMINI_MODEL_FALLBACK,
  };

  console.log("[verify-gemini] env", JSON.stringify(envStatus));

  if (!envStatus.GEMINI_API_KEY) {
    console.error("[verify-gemini] missing GEMINI_API_KEY");
    process.exit(2);
  }

  const samples: SampleCase[] = [
    { regionId: "kr", topic: buildTopic("kr", "한국 AI 규제 논쟁", "Korea AI Regulation Debate", ["AI", "regulation", "국회"]) },
    { regionId: "us", topic: buildTopic("us", "미국 반도체 보조금", "US Chip Subsidy", ["semiconductor", "subsidy", "policy"]) },
    { regionId: "jp", topic: buildTopic("jp", "일본 엔화 변동", "Japan Yen Volatility", ["yen", "fx", "boj"]) },
  ];

  let fallbackDetected = false;

  for (const sample of samples) {
    console.log(`\n[verify-gemini] sample region=${sample.regionId}`);

    const raw = await probeRawGemini(sample.regionId, sample.topic);
    console.log("[verify-gemini] raw-json", raw.slice(0, 1200));

    const result = await summarizeTopicsWithGemini([sample.topic], { regionId: sample.regionId });
    const mapped = result.topics[0];

    if (!mapped) {
      throw new Error(`no parsed topic for region=${sample.regionId}`);
    }

    const parsedView = {
      regionId: sample.regionId,
      nameKo: mapped.nameKo,
      nameEn: mapped.nameEn,
      summaryKoLength: mapped.summaryKo?.length ?? 0,
      summaryEnLength: mapped.summaryEn?.length ?? 0,
      fallbackHit: result.stats.fallbackCount > 0 || mapped.summaryKo === FALLBACK_SUMMARY_KO || mapped.summaryEn === FALLBACK_SUMMARY_EN,
      stats: result.stats,
    };

    console.log("[verify-gemini] parsed", JSON.stringify(parsedView));

    if (parsedView.fallbackHit) {
      fallbackDetected = true;
    }
  }

  if (fallbackDetected) {
    console.warn("[verify-gemini] partial fallback detected");
    process.exit(1);
  }

  console.log("[verify-gemini] all samples passed without fallback");
  process.exit(0);
}

main().catch((error) => {
  console.error("[verify-gemini] call failure", error instanceof Error ? error.message : String(error));
  process.exit(2);
});
