import { Share2, QrCode, Smartphone, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button, Card, SectionHeader, Badge } from '@renderer/shared/ui'
import { DataService } from '@renderer/shared/api'

export function SyncSettings(): React.JSX.Element {
  const [status, setStatus] = useState<{ isRunning: boolean; port: number; ip: string; deviceId: string } | null>(null)
  const [pairingPayload, setPairingPayload] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const fetchStatus = async () => {
    try {
      const status = await DataService.sync.getStatus()
      setStatus(status)
      if (status.isRunning) {
        const payload = await DataService.sync.getPairingPayload({ ip: status.ip, port: status.port })
        setPairingPayload(payload)
      }
    } catch (e) {
      console.error('Failed to fetch sync status', e)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleToggleServer = async () => {
    setIsStarting(true)
    try {
      if (status?.isRunning) {
        await DataService.sync.stopServer()
      } else {
        await DataService.sync.startServer()
      }
      await fetchStatus()
    } catch (e) {
      console.error('Failed to toggle sync server', e)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-6">
        <SectionHeader title="P2P Synchronization" icon={Share2} />
        
        <Card className="p-8 border-border bg-card shadow-none space-y-8">
          <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-foreground flex items-center gap-2">
                  Device Pairing
                  {status?.isRunning ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] animate-pulse">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  Enable the local sync server to connect your mobile device. All data stays within your local Wi-Fi network.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={handleToggleServer} 
                  disabled={isStarting}
                  className="gap-2 font-bold min-w-[160px]"
                  variant={status?.isRunning ? "destructive" : "primary"}
                >
                  {isStarting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : status?.isRunning ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <Smartphone className="h-4 w-4" />
                  )}
                  {status?.isRunning ? "Stop Sync Server" : "Start Sync Server"}
                </Button>
              </div>
            </div>

            {status?.isRunning && pairingPayload && (
              <div className="p-6 bg-white rounded-3xl shadow-2xl shadow-primary/10 border-4 border-primary/20 animate-in zoom-in duration-500">
                <QRCodeSVG value={pairingPayload} size={180} />
                <p className="text-[10px] font-black uppercase tracking-widest text-center mt-4 text-black opacity-40">
                  Scan with AutaKimi Mobile
                </p>
              </div>
            )}
          </div>

          {status?.isRunning && (
            <div className="pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Local Endpoint</p>
                <p className="font-mono text-sm">{status.ip}:{status.port}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Discovery Name</p>
                <p className="text-sm">AutaKimi-{status.deviceId.substring(0, 8)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Security Protocol</p>
                <p className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  WSS + Shared Secret
                </p>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-border/50 bg-secondary/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase tracking-tight">Step 1: Open Mobile App</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Open AutaKimi on your mobile device and navigate to <strong>More &gt; Sync with Desktop</strong>.
              </p>
            </div>
          </Card>
          <Card className="p-6 border-border/50 bg-secondary/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase tracking-tight">Step 2: Scan QR Code</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use your mobile camera to scan the QR code above. Devices will pair automatically once the Wi-Fi connection is established.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
