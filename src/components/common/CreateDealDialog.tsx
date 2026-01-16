'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateDeal } from '@/hooks/useDeals'
import { Plus } from 'lucide-react'

const createDealSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
})

type CreateDealFormData = z.infer<typeof createDealSchema>

interface CreateDealDialogProps {
  trigger?: React.ReactNode
}

export function CreateDealDialog({ trigger }: CreateDealDialogProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const createDeal = useCreateDeal()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
  })

  const onSubmit = async (data: CreateDealFormData) => {
    try {
      const deal = await createDeal.mutateAsync(data)
      toast.success('Deal created successfully')
      setOpen(false)
      reset()
      router.push(`/deals/${deal.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create deal')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Deal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Enter the merchant name to create a new deal. You can upload bank statements after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchantName">Merchant Name</Label>
            <Input
              id="merchantName"
              placeholder="Enter merchant name"
              {...register('merchantName')}
            />
            {errors.merchantName && (
              <p className="text-sm text-red-500">{errors.merchantName.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? 'Creating...' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
