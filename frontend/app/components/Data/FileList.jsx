'use client'

import { useCallback, useEffect, useState } from 'react'
import FileListItem from './FileListItem'

const BASE = 'http://localhost:8000'

export default function FileList({ refreshKey = 0, onPreview }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const handleDelete = async (file) => {
    try {
      // assumes a DELETE exists; if your route differs, tell me and I’ll wire it to that.
      const res = await fetch(`${BASE}/delete/${file.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setFiles(prev => prev.filter(f => f.id !== file.id))
    } catch (e) {
      console.error(e)
      alert('Delete failed. Check server route for DELETE /delete/:id')
    }
  }

  return (
    <div className="bg-slate-900/60 p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Files</h2>
      {loading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && files.length === 0 && (
        <p className="text-slate-400">No files uploaded yet.</p>
      )}

      <div className="space-y-3">
        {files.map(f => (
          <FileListItem
            key={f.id}
            file={f}
            onPreview={onPreview}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
