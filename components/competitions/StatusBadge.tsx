import { Badge } from '@/components/ui/Badge'
import { statusLabel, statusColorClass } from '@/lib/status'
import type { CompetitionStatus } from '@/lib/types/database'

export function StatusBadge({ status }: { status: CompetitionStatus }) {
  return <Badge className={statusColorClass(status)}>{statusLabel(status)}</Badge>
}
