export const PREFILL_STORAGE_KEY = 'prefill-competition'

export interface DiscoveredCompetition {
  name: string
  organizer: string | null
  theme: string | null
  tags: string[]
  website_url: string | null
  registration_deadline: string | null
  submission_deadline: string | null
  summary_snippet: string
}
