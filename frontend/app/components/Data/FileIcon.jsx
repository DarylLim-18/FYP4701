'use client'
import { FiFileText, FiFile, FiTable } from 'react-icons/fi'

export default function FileIcon({ type, name }) {
  const ext = (name?.split('.').pop() || '').toLowerCase()
  const base = "inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-700/60 text-slate-200"

  if (['csv', 'xlsx', 'xls'].includes(ext)) return <div className={base}><FiTable /></div>
  if (['txt', 'pdf', 'doc', 'docx'].includes(ext)) return <div className={base}><FiFileText /></div>
  return <div className={base}><FiFile /></div>
}