'use client'

import { useCallback, useState } from 'react'
import { Upload, File, FileSpreadsheet, X, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useUploadFile } from '@/hooks/useUpload'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  dealId: string
  onUploadComplete?: () => void
}

interface UploadingFile {
  file: File
  status: 'uploading' | 'success' | 'error'
  error?: string
}

const ALLOWED_EXTENSIONS = ['pdf', 'csv']
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain', // Some CSVs come as text/plain
]

export function FileUpload({ dealId, onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const uploadFile = useUploadFile()

  const isValidFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    return ALLOWED_EXTENSIONS.includes(extension || '') || ALLOWED_MIME_TYPES.includes(file.type)
  }

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension === 'csv') {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    }
    return <File className="h-5 w-5 text-red-400" />
  }

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const validFiles = fileArray.filter(isValidFile)
      const invalidCount = fileArray.length - validFiles.length

      if (invalidCount > 0) {
        toast.error(`${invalidCount} file(s) rejected. Only PDF and CSV files are allowed.`)
      }

      if (validFiles.length === 0) return

      // Add files to uploading state
      const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
        file,
        status: 'uploading' as const,
      }))

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles])

      // Upload each file
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const isCSV = file.name.split('.').pop()?.toLowerCase() === 'csv'

        try {
          await uploadFile.mutateAsync({ file, dealId })
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, status: 'success' as const } : f
            )
          )
          toast.success(
            isCSV
              ? `Imported transactions from ${file.name}`
              : `Uploaded ${file.name}`
          )
        } catch (error) {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? {
                    ...f,
                    status: 'error' as const,
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : f
            )
          )
          toast.error(`Failed to upload ${file.name}`)
        }
      }

      onUploadComplete?.()

      // Clear successful uploads after a delay
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.status !== 'success'))
      }, 3000)
    },
    [dealId, uploadFile, onUploadComplete]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles]
  )

  const removeFile = useCallback((file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
  }, [])

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or
        </p>
        <label className="mt-2 inline-block">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.csv,application/pdf,text/csv"
            multiple
            onChange={handleFileInput}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span>Browse Files</span>
          </Button>
        </label>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <File className="h-4 w-4 text-red-400" />
            <span>PDF (Bank Statements)</span>
          </div>
          <div className="flex items-center gap-1">
            <FileSpreadsheet className="h-4 w-4 text-green-500" />
            <span>CSV (Tagged Transactions)</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Max 50MB each
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              {getFileIcon(uploadingFile.file)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadingFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                  {uploadingFile.file.name.endsWith('.csv') && (
                    <span className="ml-2 text-green-600">Tagged CSV</span>
                  )}
                </p>
              </div>
              {uploadingFile.status === 'uploading' && (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              {uploadingFile.status === 'success' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {uploadingFile.status === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">{uploadingFile.error}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(uploadingFile.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
