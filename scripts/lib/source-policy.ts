export type SourcePolicyType = "active" | "keep-disabled" | "disable-until-fixed";

export interface SourcePolicyRow {
  sourceId: string;
  policy: SourcePolicyType;
  reason: string;
  alternatives: string[];
}

export const SOURCE_POLICY_ROWS: readonly SourcePolicyRow[] = [
  {
    sourceId: "naver_news_ranking",
    policy: "keep-disabled",
    reason: "robots_disallow",
    alternatives: ["daum_news_ranking", "yonhap_kr", "kbs_news_rss", "ytn_rss"],
  },
  {
    sourceId: "joongang_rss",
    policy: "disable-until-fixed",
    reason: "rss_service_terminated",
    alternatives: ["chosun_rss", "hankyoreh_rss", "yonhap_kr"],
  },
  {
    sourceId: "nikkei_rss",
    policy: "disable-until-fixed",
    reason: "rss_404_no_open_feed",
    alternatives: ["yomiuri_rss", "asahi_rss", "mainichi_rss"],
  },
  {
    sourceId: "reuters_rss",
    policy: "disable-until-fixed",
    reason: "rss_404_or_forbidden",
    alternatives: ["ap_rss", "cnn_rss", "npr_rss"],
  },
  {
    sourceId: "nytimes_rss",
    policy: "active",
    reason: "verified_rss_open_feed",
    alternatives: ["ap_rss", "npr_rss"],
  },
  {
    sourceId: "wapo_rss",
    policy: "active",
    reason: "verified_rss_open_feed",
    alternatives: ["ap_rss", "npr_rss"],
  },
  {
    sourceId: "bloomberg_rss",
    policy: "active",
    reason: "verified_rss_open_feed",
    alternatives: ["ap_rss", "npr_rss"],
  },
  {
    sourceId: "sina_news_ranking",
    policy: "disable-until-fixed",
    reason: "ranking_selector_stability_pending",
    alternatives: ["xinhua_rss"],
  },
  {
    sourceId: "sohu_news_ranking",
    policy: "active",
    reason: "verified_html_ranking_parse",
    alternatives: ["xinhua_rss"],
  },
  {
    sourceId: "163_news_ranking",
    policy: "active",
    reason: "verified_html_ranking_parse",
    alternatives: ["xinhua_rss"],
  },
  {
    sourceId: "punch_rss",
    policy: "keep-disabled",
    reason: "http_403",
    alternatives: ["thisday_rss"],
  },
  {
    sourceId: "iol_rss",
    policy: "keep-disabled",
    reason: "http_403",
    alternatives: ["news24_rss"],
  },
  {
    sourceId: "reddit_russia",
    policy: "keep-disabled",
    reason: "reddit_403",
    alternatives: ["reddit_russian", "reddit_ukraine", "habr"],
  },
  {
    sourceId: "reuters_uk_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["bbc_rss", "guardian_rss", "euronews_rss"],
  },
  {
    sourceId: "reuters_mideast_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["aljazeera_rss", "bbc_arabic_rss"],
  },
  {
    sourceId: "kompas_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["antara_rss", "detik_rss"],
  },
  {
    sourceId: "pti_rss",
    policy: "disable-until-fixed",
    reason: "empty_rss",
    alternatives: ["thehindu_rss", "timesofindia_rss", "ndtv_rss"],
  },
  {
    sourceId: "cbc_rss",
    policy: "active",
    reason: "timeout_monitor_only",
    alternatives: ["globeandmail_rss"],
  },
  {
    sourceId: "yandex_news_trending",
    policy: "active",
    reason: "timeout_monitor_only",
    alternatives: ["mail_ru_news", "tass_rss", "meduza_rss"],
  },
  {
    sourceId: "smh_rss",
    policy: "keep-disabled",
    reason: "http_403",
    alternatives: ["abc_news_rss"],
  },
  {
    sourceId: "bangkokpost_rss",
    policy: "keep-disabled",
    reason: "http_403",
    alternatives: ["thairath_rss"],
  },
  {
    sourceId: "metafilter_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["lobsters_rss", "neogaf_gaming_rss", "slashdot"],
  },
  {
    sourceId: "lobsters_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["metafilter_rss", "hackernews", "slashdot"],
  },
  {
    sourceId: "neogaf_gaming_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["resetera", "fark", "metafilter_rss"],
  },
  {
    sourceId: "hardware_fr_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["gutefrage", "mumsnet"],
  },
  {
    sourceId: "expat_mideast",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["mastodon_me", "youtube_me", "habr"],
  },
  {
    sourceId: "dtf_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["habr", "vc_ru_rss", "mastodon_ru"],
  },
  {
    sourceId: "vc_ru_rss",
    policy: "keep-disabled",
    reason: "rollout_a_canary_hold",
    alternatives: ["habr", "dtf_rss", "mastodon_ru"],
  },
] as const;

export const KEEP_DISABLED_SOURCE_ID_SET = new Set<string>(
  SOURCE_POLICY_ROWS.filter((row) => row.policy === "keep-disabled").map((row) => row.sourceId),
);

export const ACTIVE_SOURCE_ID_SET = new Set<string>(
  SOURCE_POLICY_ROWS.filter((row) => row.policy === "active").map((row) => row.sourceId),
);
