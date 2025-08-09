'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FaCloudUploadAlt } from 'react-icons/fa'

export default function UploadDropzone({ onUploaded }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setIsProcessing(true)
    setError(null)

    try {
      const file = acceptedFiles[0]
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: form
      })
      if (!res.ok) throw new Error(await res.text())

      onUploaded?.()
    } catch (e) {
      console.error(e)
      setError('Upload failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [onUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    }
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition
        ${isDragActive ? 'border-blue-400 bg-slate-800' : 'border-slate-600 hover:border-slate-400'}
      `}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 border-4 border-t-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
          <span className="text-blue-400">Uploading…</span>
        </div>
      ) : (
        <>
          <FaCloudUploadAlt size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-lg font-medium">Click to upload or drag and drop</p>
          <p className="text-sm text-slate-500 mt-1">CSV or Excel files</p>
          {error && <p className="mt-2 text-red-400">{error}</p>}
        </>
      )}
    </div>
  )
}
