/*Reused from the Data component but added a check icon instead of delete*/
'use client';

import FileIcon from '../Data/FileIcon';
import { FiEye, FiCheckCircle } from 'react-icons/fi'

export default function FileListItem({ file, onPreview, onSelect }) {
  return (
    <div className="flex items-center p-3 bg-slate-800 rounded-lg hover:bg-slate-700/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <FileIcon name={file.file_name} type={file.file_type} />
      <div className="ml-3 flex-grow overflow-hidden">
        <p className="font-medium text-slate-200 truncate" title={file.file_name}>
          {file.file_name}
        </p>
      </div>
      <div className="flex items-center space-x-2 ml-4">
        <button
          onClick={() => onPreview?.(file)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-full transition-colors"
          title="Preview"
        >
          <FiEye className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSelect?.(file)}
          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-600 rounded-full transition-colors"
          title="Select"
        >
          <FiCheckCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
