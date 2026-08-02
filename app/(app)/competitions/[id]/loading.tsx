import { Skeleton } from '@/components/ui/Skeleton'

export default function LoadingCompetitionDetail() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
