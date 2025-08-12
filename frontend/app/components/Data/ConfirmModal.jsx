'use client'
import { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'

export default function ConfirmModal({
  open, title = 'Delete file',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm, onCancel, loading = false
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      // Let the component mount, then trigger the transition
      const id = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(id)
    } else {
      setEntered(false)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4
                  bg-black/50 backdrop-blur-sm
                  transition-opacity duration-300
                  ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-slate-900 text-slate-100 shadow-xl
                    border border-white/10
                    origin-center
                    transition-all duration-300 ease-out
                    ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                    ${entered ? 'animate-[expandY_300ms_ease-out]' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onCancel} className="p-2 rounded hover:bg-white/10" disabled={loading}>
            <FiX />
          </button>
        </div>

        <div className="px-5 py-4 text-slate-300">{message}</div>

        <div className="px-5 py-4 flex justify-end gap-2 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting…' : confirmText}
          </button>
        </div>
      </div>

      {/* Keyframes for vertical expand */}
      <style jsx>{`
        @keyframes expandY {
          0%   { transform: scaleY(0.9) scaleX(0.97); opacity: 0; }
          100% { transform: scaleY(1)    scaleX(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
