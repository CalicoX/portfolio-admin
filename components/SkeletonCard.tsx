import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <div className="aspect-square bg-muted animate-pulse" />
    <CardContent className="p-3 space-y-2">
      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
    </CardContent>
  </Card>
);

export const SkeletonIndex = () => (
  <Card className="w-full">
    <CardHeader>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 bg-muted rounded w-32 animate-pulse" />
          <div className="h-3 bg-muted rounded w-48 animate-pulse" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-20 animate-pulse" />
            <div className="h-10 bg-muted rounded w-full animate-pulse" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const SkeletonGrid = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(count)].map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
