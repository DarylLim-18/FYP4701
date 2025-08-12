'use client'

import { useCallback, useEffect, useState } from 'react'
import FileListItem from './FileListItem'
import ConfirmModal from './ConfirmModal'

const BASE = 'http://localhost:8000'

export default function FileList({ refreshKey = 0, onPreview }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [filePendingDelete, setFilePendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BASE}/list`)
      if (!res.ok) throw new Error('Failed to fetch list')
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setError('Failed to load files.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const requestDelete = (file) => {
    setFilePendingDelete(file)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!filePendingDelete) return
    try {
      setDeleting(true)
      const res = await fetch(`${BASE}/delete/${filePendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setFiles(prev => prev.filter(f => f.id !== filePendingDelete.id))
    } catch (e) {
      console.error(e)
      alert('Delete failed. Check server route for DELETE /delete/:id')
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
      setFilePendingDelete(null)
    }
  }

  return (
    <div className="bg-slate-900/60 p-6 rounded-2xl shadow-lg">
      {/* existing list UI */}
      <div className="space-y-3">
        {files.map(f => (
          <FileListItem
            key={f.id}
            file={f}
            onPreview={onPreview}
            onDelete={requestDelete}   // << open modal instead of deleting immediately
          />
        ))}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete this file?"
        message={filePendingDelete ? `“${filePendingDelete.file_name}” will be removed from storage.` : ''}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => { if (!deleting) { setConfirmOpen(false); setFilePendingDelete(null) } }}
        loading={deleting}
      />
    </div>
  )
}
