import { LoadingCards, Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-page space-y-8 py-12">
      <div className="flex items-center justify-center gap-3 text-sm font-bold text-ink/45">
        <Spinner />
        در حال آماده‌سازی صفحه…
      </div>
      <LoadingCards count={3} />
      <LoadingCards count={3} />
    </div>
  );
}
