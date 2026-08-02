'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/competitions/StatusBadge'
import { ProgressStages } from '@/components/competitions/ProgressStages'
import { CompetitionForm } from '@/components/competitions/CompetitionForm'
import { DuplicateCompetitionAction } from '@/components/competitions/DuplicateCompetitionAction'
import { ShareableExportAction } from '@/components/detail/ShareableExportAction'
import { DocumentsSection } from '@/components/detail/DocumentsSection'
import { LinksSection } from '@/components/detail/LinksSection'
import { AiSummaryCard } from '@/components/detail/AiSummaryCard'
import { CompetitionChatDrawer } from '@/components/detail/CompetitionChatDrawer'
import { RundownList } from '@/components/detail/RundownList'
import { RundownItemModal } from '@/components/detail/RundownItemModal'
import { NotificationLog } from '@/components/detail/NotificationLog'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCompetitionDetail, useCompetitionDocuments, useUpdateCompetition } from '@/hooks/useCompetitionDetail'
import { useDeleteCompetition } from '@/hooks/useCompetitions'
import { useRundownItems, useCreateRundownItem, useNotificationLogs } from '@/hooks/useRundown'
import { useAiSummary, useGenerateAiSummary } from '@/hooks/useAiSummary'
import { formatTag } from '@/lib/tags'
import type { CompetitionFormValues } from '@/lib/validation'

function AiSummarySection({ competitionId, onGenerateStateChange }: { competitionId: string; onGenerateStateChange?: (isGenerating: boolean) => void }) {
  const { data: summary, isLoading } = useAiSummary(competitionId)
  const { mutate: generate, isPending } = useGenerateAiSummary()

  return (
    <AiSummaryCard
      summary={summary ?? null}
      isLoading={isLoading}
      isGenerating={isPending}
      onRegenerate={(model) => generate({ competitionId, preferredModel: model })}
    />
  )
}

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: competition, isLoading } = useCompetitionDetail(id)
  const { data: documents = [] } = useCompetitionDocuments(id)
  const { mutateAsync } = useUpdateCompetition(id)
  const { mutateAsync: deleteComp, isPending: isDeleting } = useDeleteCompetition()
  const { data: rundownItems = [] } = useRundownItems(id)
  const { mutate: createRundownItem } = useCreateRundownItem(id)
  const { data: notificationLogs = [] } = useNotificationLogs(rundownItems.map((r) => r.id))
  const { mutate: generateAiSummary, isPending: isGeneratingAi } = useGenerateAiSummary()
  const { data: summary, isLoading: isLoadingSummary } = useAiSummary(id)

  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [isAddRundownModalOpen, setIsAddRundownModalOpen] = useState(false)

  if (isLoading || !competition) return null

  async function handleSubmit(values: CompetitionFormValues) {
    await mutateAsync(values)
    setIsEditing(false)
  }

  async function handleConfirmDelete() {
    await deleteComp(id)
    setIsConfirmDeleteOpen(false)
    router.push('/dashboard')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{competition.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={competition.status} />
            {competition.tags.filter((t) => t && t !== '_' && t.trim() !== '').length > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                • {competition.tags.filter((t) => t && t !== '_' && t.trim() !== '').map(formatTag).join(', ')}
              </span>
            )}
          </div>
          <ProgressStages status={competition.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ShareableExportAction competition={competition} />
          <DuplicateCompetitionAction competition={competition} />
          <Button variant="secondary" size="sm" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setIsConfirmDeleteOpen(true)} isLoading={isDeleting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Delete Competition"
        description={`Are you sure you want to delete "${competition.name}"? This action will permanently remove all associated documents, AI summaries, and rundown items.`}
        confirmLabel="Delete Competition"
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsConfirmDeleteOpen(false)}
      />

      {isEditing ? (
        <CompetitionForm
          defaultValues={{
            name: competition.name,
            organizer: competition.organizer ?? '',
            theme: competition.theme ?? '',
            team_name: competition.team_name ?? '',
            team_members: competition.team_members ?? [],
            instagram_url: competition.instagram_url ?? '',
            website_url: competition.website_url ?? '',
            registration_deadline: competition.registration_deadline ?? '',
            submission_deadline: competition.submission_deadline ?? '',
            event_start_at: competition.event_start_at ?? '',
            event_end_at: competition.event_end_at ?? '',
            location: competition.location ?? '',
            notes: competition.notes ?? '',
            tags: competition.tags,
          }}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          isEditMode={true}
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {competition.organizer && <p>Organizer: {competition.organizer}</p>}
            {competition.theme && <p>Theme: {competition.theme}</p>}
            {competition.team_name && <p>Team: {competition.team_name}</p>}
            {competition.team_members && competition.team_members.length > 0 && (
              <p>Team Members: {competition.team_members.join(', ')}</p>
            )}
            {competition.location && <p>Location: {competition.location}</p>}
            {competition.notes && <p className="whitespace-pre-wrap">{competition.notes}</p>}
          </div>
          <LinksSection instagramUrl={competition.instagram_url} websiteUrl={competition.website_url} />
          
          <AiSummaryCard
            summary={summary ?? null}
            isLoading={isLoadingSummary}
            isGenerating={isGeneratingAi}
            onRegenerate={(model) => generateAiSummary({ competitionId: id, preferredModel: model })}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Guidebooks &amp; Documents</h2>
            <DocumentsSection competitionId={competition.id} documents={documents} />
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Timeline &amp; Rundown</h2>
              <Button variant="secondary" size="sm" onClick={() => setIsAddRundownModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
            <RundownList items={rundownItems} isLoading={isGeneratingAi} />
            <RundownItemModal
              isOpen={isAddRundownModalOpen}
              onClose={() => setIsAddRundownModalOpen(false)}
              onSubmit={createRundownItem}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Notification Log</h2>
            <NotificationLog logs={notificationLogs} />
          </section>
        </div>
      )}

      <CompetitionChatDrawer competitionId={id} competitionName={competition.name} />
    </div>
  )
}
