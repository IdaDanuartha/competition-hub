import { formatDateTime } from '@/lib/date-format'
import type { Competition, AiSummary } from '@/lib/types/database'

export function generateShareableBrief(competition: Competition, summary?: AiSummary | null): string {
  const lines: string[] = []

  lines.push(`🏆 COMPETITION BRIEF: ${competition.name}`)
  lines.push(`==========================================`)
  if (competition.organizer) lines.push(`Organizer: ${competition.organizer}`)
  if (competition.status) lines.push(`Status: ${competition.status.toUpperCase()}`)
  if (competition.team_name) {
    const membersStr = competition.team_members?.length ? ` (${competition.team_members.join(', ')})` : ''
    lines.push(`Team: ${competition.team_name}${membersStr}`)
  }
  if (competition.location) lines.push(`Location: ${competition.location}`)
  lines.push('')

  lines.push(`📅 DEADLINES`)
  lines.push(`------------------------------------------`)
  if (competition.registration_deadline) lines.push(`- Registration: ${formatDateTime(competition.registration_deadline)}`)
  if (competition.submission_deadline) lines.push(`- Submission: ${formatDateTime(competition.submission_deadline)}`)
  if (competition.event_start_at) lines.push(`- Event Start: ${formatDateTime(competition.event_start_at)}`)
  lines.push('')

  if (summary) {
    lines.push(`💡 AI SUMMARY & ADVICE`)
    lines.push(`------------------------------------------`)
    lines.push(`Overview: ${summary.summary}`)
    if (summary.theme_and_subtheme) lines.push(`Theme: ${summary.theme_and_subtheme}`)
    
    if (summary.project_idea_suggestions.length > 0) {
      lines.push(`\nSuggested Project Ideas:`)
      summary.project_idea_suggestions.forEach((idea) => {
        lines.push(`* ${idea.title}: ${idea.description}`)
        lines.push(`  (Rationale: ${idea.rationale})`)
      })
    }
    lines.push('')
  }

  lines.push(`🔗 LINKS`)
  lines.push(`------------------------------------------`)
  if (competition.website_url) lines.push(`Website: ${competition.website_url}`)
  if (competition.instagram_url) lines.push(`Instagram: ${competition.instagram_url}`)

  return lines.join('\n')
}
