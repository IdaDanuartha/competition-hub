import type { AiSummary, PortfolioEntry } from '@/lib/types/database'

export interface AiSummaryPromptInput {
  competitionName: string
  organizer?: string | null
  extractedText: string
}

export function buildAiPrompt({ competitionName, organizer, extractedText }: AiSummaryPromptInput): string {
  return `You are an expert competition advisor. Analyze the following competition guidebook text for "${competitionName}"${organizer ? ` organized by ${organizer}` : ''}.

Extract structured insights in strict JSON format:
{
  "summary": "Concise 2-3 sentence overview of the competition objectives and scope",
  "key_requirements": ["Requirement 1 (eligibility, team size)", "Requirement 2 (submission format, page limits)"],
  "important_dates": ["Date 1 (e.g. Registration deadline: YYYY-MM-DD)", "Date 2"],
  "judging_criteria": ["Criteria 1 with weight/scoring", "Criteria 2"],
  "theme_and_subtheme": "Extracted primary theme and sub-themes",
  "project_idea_suggestions": [
    {
      "title": "Concrete Project Idea 1",
      "description": "Short explanation of the concept",
      "rationale": "Why this fits the theme and judging criteria"
    },
    {
      "title": "Concrete Project Idea 2",
      "description": "Short explanation of the concept",
      "rationale": "Why this fits the theme and judging criteria"
    }
  ]
}

Guidebook Text:
${extractedText.slice(0, 15000)}
`
}

export function matchPortfolioEntries(
  themeAndSubtheme: string | null,
  portfolioEntries: PortfolioEntry[]
): PortfolioEntry[] {
  if (!themeAndSubtheme || portfolioEntries.length === 0) return []
  const normalizedTheme = themeAndSubtheme.toLowerCase()
  
  return portfolioEntries.filter((entry) => {
    const hasTagMatch = entry.tags.some((tag) => normalizedTheme.includes(tag.toLowerCase()))
    const hasNameMatch = normalizedTheme.includes(entry.name.toLowerCase())
    return hasTagMatch || hasNameMatch
  })
}
