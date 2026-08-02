export interface TagOption {
  value: string
  label: string
}

export const TAG_OPTIONS: TagOption[] = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'web_design', label: 'Web Design' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'mobile_development', label: 'Mobile Development' },
  { value: 'software_development', label: 'Software Development' },
  { value: 'ui_ux_design', label: 'UI/UX Design' },
  { value: 'other', label: 'Other' },
]

export function formatTag(tag: string): string {
  const match = TAG_OPTIONS.find((t) => t.value === tag)
  if (match) return match.label

  // Support legacy tags gracefully
  if (tag === 'ui_ux') return 'UI/UX Design'
  if (tag === 'business_plan') return 'Business Plan'
  if (tag === 'proposal_only') return 'Proposal Only'

  return tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
