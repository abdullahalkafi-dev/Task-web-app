import { Skeleton } from "../ui/Skeleton";

export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading tasks" className="grid gap-5 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ))}
    </div>
  );
}
