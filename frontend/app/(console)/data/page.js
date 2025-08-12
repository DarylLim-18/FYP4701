'use client'
import { useState, useCallback } from 'react'
import UploadDropzone from '../../components/Data/UploadDropzone'
import FileList from '../../components/Data/FileList'
import PreviewModal from '../../components/Data/PreviewModal'

export default function DataPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  const bump = useCallback(() => setRefreshKey(k => k + 1), [])

  const handlePreview = (file) => {
    setPreviewFile(file)
    setPreviewOpen(true)
  }

  return (
    <main className="space-y-4">
      {/* Header card */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-6 text-white">
        <h1 className="text-2xl font-bold">Data Management</h1>
        <p className="text-slate-300">All your data analytics and management tools</p>
      </div>

      {/* Content card */}
      <div className="bg-gray-800/60 rounded-2xl shadow-xl p-6 text-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <UploadDropzone onUploaded={bump} />
          </div>
          <div className="lg:col-span-7">
            <FileList refreshKey={refreshKey} onPreview={handlePreview} />
          </div>
        </div>
      </div>
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        file={previewFile}
      />
    </main>
  )
}
