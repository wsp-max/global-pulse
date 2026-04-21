import { resolveMeaningfulTopicNames, type Topic } from "@global-pulse/shared";

export function normalizeTopicNamesForStorage(topic: Topic): Pick<Topic, "nameKo" | "nameEn"> {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    summaryKo: topic.summaryKo,
    summaryEn: topic.summaryEn,
    sampleTitles: topic.sampleTitles,
    keywords: topic.keywords,
    entities: topic.entities,
  });

  return {
    nameKo: resolved.nameKo || topic.nameKo,
    nameEn: resolved.nameEn || topic.nameEn,
  };
}
