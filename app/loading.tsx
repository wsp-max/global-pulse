import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
      <LoadingSkeleton className="h-32" lines={5} />
    </main>
  );
}

