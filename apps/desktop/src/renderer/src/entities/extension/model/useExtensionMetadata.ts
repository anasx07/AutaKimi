import { DataService } from '@renderer/shared/api'
import { useState, useEffect } from 'react'
import animeExtensions from '@renderer/shared/api/anime-sources/Anime.json'

export interface ExtensionMetadata {
  name: string
  baseUrl: string
  icon?: string
}

export function useExtensionMetadata(pkg: string | null) {
  const [metadata, setMetadata] = useState<ExtensionMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!pkg) {
        setMetadata(null)
        return
      }
      setLoading(true)
      try {
        const res = await DataService.db.getExtension(pkg)
        if (res) {
          setMetadata({
            name: res.name || 'Unknown Source',
            baseUrl: res.baseUrl || '',
            icon: res.icon
          })
        } else {
          // Check native anime sources
          const anime = animeExtensions.find((a) => a.pkg === pkg)
          if (anime) {
            setMetadata({
              name: anime.name,
              baseUrl: anime.sources[0]?.baseUrl || '',
              icon: anime.pkg
            })
          }
        }
      } catch (err) {
        console.error(`[useExtensionMetadata] Failed to fetch for ${pkg}:`, err)
      } finally {
        setLoading(false)
      }
    }

    fetchMetadata()
  }, [pkg])

  return { metadata, loading }
}
