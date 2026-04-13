interface TimeAgoProps {
  isoTime: string;
  nowIsoTime: string;
}

export function TimeAgo({ isoTime, nowIsoTime }: TimeAgoProps) {
  const diffMs = new Date(nowIsoTime).getTime() - new Date(isoTime).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return <span>{minutes}분 전</span>;
}
