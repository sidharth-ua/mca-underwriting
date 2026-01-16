'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdateDeal } from '@/hooks/useDeals'

type Decision = 'APPROVED' | 'DECLINED' | 'MORE_INFO'

interface DecisionPanelProps {
  dealId: string
  currentDecision?: Decision | null
  currentNotes?: string | null
  onDecisionMade?: () => void
}

const decisionConfig = {
  APPROVED: {
    label: 'Approve',
    description: 'Approve this deal for funding',
    icon: CheckCircle,
    color: 'bg-green-500 hover:bg-green-600',
    textColor: 'text-green-600',
  },
  DECLINED: {
    label: 'Decline',
    description: 'Decline this deal',
    icon: XCircle,
    color: 'bg-red-500 hover:bg-red-600',
    textColor: 'text-red-600',
  },
  MORE_INFO: {
    label: 'Request Info',
    description: 'Request additional information',
    icon: HelpCircle,
    color: 'bg-yellow-500 hover:bg-yellow-600',
    textColor: 'text-yellow-600',
  },
}

export function DecisionPanel({
  dealId,
  currentDecision,
  currentNotes,
  onDecisionMade,
}: DecisionPanelProps) {
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [notes, setNotes] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const updateDeal = useUpdateDeal()

  const handleDecisionClick = (decision: Decision) => {
    setSelectedDecision(decision)
    setNotes('')
    setIsDialogOpen(true)
  }

  const handleConfirm = async () => {
    if (!selectedDecision) return

    try {
      await updateDeal.mutateAsync({
        id: dealId,
        decision: selectedDecision,
        decisionNotes: notes,
        status: 'DECIDED',
      })
      toast.success(`Deal ${selectedDecision.toLowerCase().replace('_', ' ')}`)
      setIsDialogOpen(false)
      onDecisionMade?.()
    } catch (error) {
      toast.error('Failed to save decision')
    }
  }

  const DecisionIcon = selectedDecision ? decisionConfig[selectedDecision].icon : null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Make Decision</CardTitle>
        </CardHeader>
        <CardContent>
          {currentDecision ? (
            <div className="space-y-4">
              <div
                className={`flex items-center gap-2 ${decisionConfig[currentDecision].textColor}`}
              >
                {(() => {
                  const Icon = decisionConfig[currentDecision].icon
                  return <Icon className="h-5 w-5" />
                })()}
                <span className="font-medium">
                  Decision: {decisionConfig[currentDecision].label}
                </span>
              </div>
              {currentNotes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">{currentNotes}</p>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsDialogOpen(true)}
              >
                Change Decision
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {(Object.keys(decisionConfig) as Decision[]).map((decision) => {
                const config = decisionConfig[decision]
                const Icon = config.icon
                return (
                  <Button
                    key={decision}
                    className={`w-full ${config.color} text-white`}
                    onClick={() => handleDecisionClick(decision)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {config.label}
                  </Button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {DecisionIcon && (
                <DecisionIcon
                  className={`h-5 w-5 ${
                    selectedDecision ? decisionConfig[selectedDecision].textColor : ''
                  }`}
                />
              )}
              {selectedDecision
                ? `Confirm ${decisionConfig[selectedDecision].label}`
                : 'Change Decision'}
            </DialogTitle>
            <DialogDescription>
              {selectedDecision
                ? decisionConfig[selectedDecision].description
                : 'Select a new decision for this deal'}
            </DialogDescription>
          </DialogHeader>

          {!selectedDecision && (
            <div className="grid gap-3 py-4">
              {(Object.keys(decisionConfig) as Decision[]).map((decision) => {
                const config = decisionConfig[decision]
                const Icon = config.icon
                return (
                  <Button
                    key={decision}
                    variant="outline"
                    className={`w-full justify-start ${
                      currentDecision === decision ? 'border-2 border-primary' : ''
                    }`}
                    onClick={() => setSelectedDecision(decision)}
                  >
                    <Icon className={`mr-2 h-4 w-4 ${config.textColor}`} />
                    {config.label}
                  </Button>
                )
              })}
            </div>
          )}

          {selectedDecision && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Decision Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about your decision..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            {selectedDecision && (
              <Button
                className={decisionConfig[selectedDecision].color}
                onClick={handleConfirm}
                disabled={updateDeal.isPending}
              >
                {updateDeal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm {decisionConfig[selectedDecision].label}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
