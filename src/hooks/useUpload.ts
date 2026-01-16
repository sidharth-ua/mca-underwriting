import { useMutation, useQueryClient } from '@tanstack/react-query'

interface UploadResponse {
  id: string
  dealId: string
  filename: string
  originalName: string
  status: string
}

interface UploadInput {
  file: File
  dealId: string
}

async function uploadFile({ file, dealId }: UploadInput): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('dealId', dealId)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload file')
  }

  return response.json()
}

export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal', data.dealId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
