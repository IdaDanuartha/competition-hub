import { z } from 'zod'

const optionalString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val && val.trim() !== '' ? val : null))

const optionalUrl = z
  .string()
  .url()
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((val) => (val && val.trim() !== '' ? val : null))

const instagramUrl = z
  .string()
  .url()
  .refine((url) => /instagram\.com/i.test(url), 'Must be an instagram.com URL')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((val) => (val && val.trim() !== '' ? val : null))

export const competitionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  organizer: optionalString,
  theme: optionalString,
  team_name: optionalString,
  instagram_url: instagramUrl,
  website_url: optionalUrl,
  registration_deadline: optionalString,
  submission_deadline: optionalString,
  event_start_at: optionalString,
  event_end_at: optionalString,
  location: optionalString,
  tags: z.array(z.string()).default([]),
  team_members: z.array(z.string()).default([]),
  notes: optionalString,
})

export type CompetitionFormValues = z.infer<typeof competitionSchema>

export const rundownItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: optionalString,
  event_at: z.string().min(1, 'Date/time is required'),
  reminder_offsets_minutes: z.array(z.number().int().positive()).optional(),
})

export type RundownItemFormValues = z.infer<typeof rundownItemSchema>

export const settingsSchema = z.object({
  whatsapp_number: z
    .string()
    .regex(/^62\d{8,13}$/, 'Use format 62xxxxxxxxxx')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val : null)),
  default_reminder_offsets_minutes: z.array(z.number().int().positive()).min(1),
  rundown_generation_mode: z.enum(['auto', 'manual']),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
