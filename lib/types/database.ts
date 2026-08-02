export type CompetitionStatus =
  | 'researching' | 'registered' | 'in_progress' | 'submitted'
  | 'finalist' | 'completed' | 'not_selected'

export type DocumentType = 'guidebook' | 'addendum' | 'template' | 'other'
export type NotificationStatus = 'sent' | 'failed'
export type RundownGenerationMode = 'auto' | 'manual'
export type ThemePreference = 'light' | 'dark'

export type Competition = {
  id: string
  user_id: string
  name: string
  organizer: string | null
  theme: string | null
  status: CompetitionStatus
  team_name: string | null
  team_members?: string[]
  instagram_url: string | null
  website_url: string | null
  registration_deadline: string | null
  submission_deadline: string | null
  event_start_at: string | null
  event_end_at: string | null
  location: string | null
  tags: string[]
  cloned_from_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CompetitionDocument = {
  id: string
  competition_id: string
  file_name: string
  cloudinary_public_id: string
  cloudinary_url: string
  doc_type: DocumentType
  extracted_text: string | null
  uploaded_at: string
}

export type RundownItem = {
  id: string
  competition_id: string
  title: string
  description: string | null
  event_at: string
  reminder_offsets_minutes: number[] | null
  is_auto_generated: boolean
  auto_source: string | null
  created_at: string
}

export type NotificationLog = {
  id: string
  rundown_item_id: string
  channel: string
  message: string
  status: NotificationStatus
  attempt_count: number
  sent_at: string
}

export type UserSettings = {
  id: string
  whatsapp_number: string | null
  default_reminder_offsets_minutes: number[]
  timezone: string
  rundown_generation_mode: RundownGenerationMode
  theme_preference: ThemePreference
}

export type ProjectIdeaSuggestion = {
  title: string
  description: string
  rationale: string
}

export type AiSummary = {
  id: string
  competition_id: string
  summary: string
  key_requirements: string[]
  important_dates: string[]
  judging_criteria: string[]
  theme_and_subtheme: string | null
  project_idea_suggestions: ProjectIdeaSuggestion[]
  model_used: string
  created_at: string
  updated_at: string
}

export type PortfolioEntry = {
  id: string
  user_id: string
  name: string
  description: string | null
  tags: string[]
  tech_stack: string[]
  used_in_competitions: string[]
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      competitions: { Row: Competition; Insert: Partial<Competition> & { user_id: string; name: string }; Update: Partial<Competition>; Relationships: [] }
      competition_documents: { Row: CompetitionDocument; Insert: Partial<CompetitionDocument> & { competition_id: string; file_name: string; cloudinary_public_id: string; cloudinary_url: string }; Update: Partial<CompetitionDocument>; Relationships: [] }
      rundown_items: { Row: RundownItem; Insert: Partial<RundownItem> & { competition_id: string; title: string; event_at: string }; Update: Partial<RundownItem>; Relationships: [] }
      notification_logs: { Row: NotificationLog; Insert: Partial<NotificationLog> & { rundown_item_id: string; message: string; status: NotificationStatus }; Update: Partial<NotificationLog>; Relationships: [] }
      user_settings: { Row: UserSettings; Insert: Partial<UserSettings> & { id: string }; Update: Partial<UserSettings>; Relationships: [] }
      ai_summaries: { Row: AiSummary; Insert: Partial<AiSummary> & { competition_id: string; summary: string }; Update: Partial<AiSummary>; Relationships: [] }
      portfolio_entries: { Row: PortfolioEntry; Insert: Partial<PortfolioEntry> & { user_id: string; name: string }; Update: Partial<PortfolioEntry>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
