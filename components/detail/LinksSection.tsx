import { Camera, Globe } from 'lucide-react'

interface LinksSectionProps {
  instagramUrl: string | null
  websiteUrl: string | null
}

export function LinksSection({ instagramUrl, websiteUrl }: LinksSectionProps) {
  if (!instagramUrl && !websiteUrl) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No links added yet.</p>
  }

  return (
    <div className="space-y-2">
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
        >
          <Camera className="h-4 w-4" />
          Instagram
        </a>
      )}
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
        >
          <Globe className="h-4 w-4" />
          Website
        </a>
      )}
    </div>
  )
}
