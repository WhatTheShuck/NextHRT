import { Skeleton } from "@/components/ui/skeleton";

export default function PermissionsLoading() {
  return (
    <div className="container mx-auto py-10">
      <Skeleton className="h-9 w-52 mb-6" />
      <Skeleton className="h-10 w-full rounded-md mb-4" />
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-9 flex-1 w-full mb-4" />
        <div className="border rounded-md">
          <div className="p-3 border-b grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 border-b last:border-0 grid grid-cols-4 gap-4 items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
