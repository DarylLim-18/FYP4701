'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { FiX } from 'react-icons/fi'

const BASE = 'http://localhost:8000'
const PAGE_SIZE = 50

export default function PreviewModal({ open, onClose, file }) {
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [total, setTotal] = useState(0)
  const [initialLoading, setInitialLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [entered, setEntered] = useState(false)

  const sentinelRef = useRef(null)
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async (offset) => {
    if (!file || fetchingRef.current) return
    fetchingRef.current = true
    const isInitial = offset === 0
    try {
      if (isInitial) {
        setInitialLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      const res = await fetch(`${BASE}/preview/${file.id}?offset=${offset}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()

      if (isInitial) {
        setHeaders(Array.isArray(json.columns) ? json.columns : [])
        setRows(Array.isArray(json.rows) ? json.rows : [])
        setTotal(json.total ?? 0)
        setHasMore((json.rows?.length || 0) < (json.total ?? 0))
      } else {
        setRows(prev => {
          const next = Array.isArray(json.rows) ? json.rows : []
          const merged = prev.concat(next)
          setHasMore(merged.length < (json.total ?? merged.length))
          return merged
        })
      }
    } catch (e) {
      setError(e.message || 'Preview failed')
    } finally {
      if (isInitial) setInitialLoading(false)
      setLoadingMore(false)
      fetchingRef.current = false
    }
  }, [file])

  useEffect(() => {
    if (!open || !file) return
    setRows([]); setHeaders([]); setTotal(0); setHasMore(false); setError(null)
    fetchPage(0)
  }, [open, file, fetchPage])

  useEffect(() => {
    if (!open || !file) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry.isIntersecting && hasMore && !loadingMore && !initialLoading) {
        fetchPage(rows.length)
      }
    }, { root: null, rootMargin: '200px 0px', threshold: 0 })

    obs.observe(el)
    return () => obs.disconnect()
  }, [open, file, rows.length, hasMore, loadingMore, initialLoading, fetchPage])

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(id)
    } else {
      setEntered(false)
    }
  }, [open])

  if (!open || !file) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-slate-900 text-slate-100 w-full max-w-5xl rounded-2xl shadow-xl border border-white/10 origin-center transition-all duration-300 ease-out ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold truncate">
            {file.file_name}
            {total ? <span className="ml-2 text-xs text-slate-400">({rows.length}/{total})</span> : null}
          </h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/10" title="Close" aria-label="Close preview">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {initialLoading && <p className="text-slate-300">Loading preview…</p>}
          {error && <p className="text-red-400">{error}</p>}

          {!initialLoading && !error && rows.length > 0 && (
            <div className="overflow-auto max-h-[70vh] border border-white/10 rounded">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-white/10">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="odd:bg-white/0 even:bg-white/[0.03]">
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                          {String(r[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={headers.length}>
                      <div ref={sentinelRef} className="h-2 w-full flex items-center justify-center">
                        {loadingMore && <span className="text-slate-400">Loading more…</span>}
                        {!hasMore && rows.length > 0 && <span className="text-slate-500 text-xs">End of preview</span>}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!initialLoading && !error && rows.length === 0 && (
            <p className="text-slate-300">No rows to display.</p>
          )}
        </div>
      </div>
    </div>
  )
}
