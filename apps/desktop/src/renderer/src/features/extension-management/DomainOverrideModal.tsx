import { useState, useEffect } from 'react'
import { Globe, RotateCcw, Save } from 'lucide-react'
import { Dialog, Button, Input } from '@renderer/shared/ui'
import { useExtensionStore } from '@renderer/shared/model'
import { reloadSource } from '@renderer/shared/api/sources'

interface DomainOverrideModalProps {
  isOpen: boolean
  onClose: () => void
  pkg: string
  name: string
  defaultDomain: string
}

export function DomainOverrideModal({
  isOpen,
  onClose,
  pkg,
  name,
  defaultDomain
}: DomainOverrideModalProps) {
  const { domainOverrides, setDomainOverride } = useExtensionStore()
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNewDomain(domainOverrides[pkg] || defaultDomain)
    }
  }, [isOpen, pkg, domainOverrides, defaultDomain])

  const handleSave = async () => {
    // Basic validation
    let domain = newDomain.trim()
    if (domain && !domain.startsWith('http')) {
      domain = `https://${domain}`
    }

    // Remove trailing slash
    domain = domain.replace(/\/+$/, '')

    await setDomainOverride(pkg, domain === defaultDomain ? null : domain)
    reloadSource(pkg)
    onClose()
  }

  const handleReset = async () => {
    await setDomainOverride(pkg, null)
    reloadSource(pkg)
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Source Settings">
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/50">
          <Globe className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{pkg}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground px-1">
            Base URL (Domain)
          </label>
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="https://example.com"
            className="bg-secondary/10"
          />
          <p className="text-[10px] text-muted-foreground px-1">
            Override the domain if the site has moved. Include <code>https://</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" className="flex-1 gap-2 text-xs h-9" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button className="flex-1 gap-2 text-xs h-9" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
