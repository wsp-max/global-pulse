import { TopicPageClient } from "@/components/topic/TopicPageClient";

interface TopicPageProps {
  params: Promise<{ topicId: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topicId } = await params;

  return <TopicPageClient topicId={topicId} />;
}


