import { DataService } from '@renderer/shared/api'
import { useState, useEffect } from 'react'

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
