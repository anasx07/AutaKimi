import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@renderer/shared/model'

export default function AnimePage(): React.JSX.Element {
  const navigate = useNavigate()
  const { setBrowseMediaType } = useSettingsStore()

  useEffect(() => {
    setBrowseMediaType('anime').then(() => {
      navigate('/browse', { replace: true })
    })
  }, [navigate, setBrowseMediaType])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
    </div>
  )
}
