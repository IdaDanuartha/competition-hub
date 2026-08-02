'use client'

import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDuplicateCompetition } from '@/hooks/useDuplicateCompetition'
import type { Competition } from '@/lib/types/database'

export function DuplicateCompetitionAction({ competition }: { competition: Competition }) {
  const router = useRouter()
  const { mutateAsync, isPending } = useDuplicateCompetition()

  async function handleClick() {
    const copy = await mutateAsync(competition)
    router.push(`/competitions/${copy.id}`)
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      <Copy className="h-3.5 w-3.5" />
      {isPending ? 'Duplicating...' : 'Duplicate'}
    </Button>
  )
}
