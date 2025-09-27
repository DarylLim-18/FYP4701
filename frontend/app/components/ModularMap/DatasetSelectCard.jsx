'use client';

export default function DatasetSelectCard({ file, onOpen }) {
  if (!file) {
    return (
      <button
        onClick={onOpen}
        className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 backdrop-blur-sm p-6 text-left hover:border-white/25 hover:bg-white/10 transition"
      >
        <div className="text-sm font-semibold text-gray-200 mb-1">Select Your Dataset</div>
        <div className="text-xs text-gray-400">No dataset selected — click to choose from uploaded files.</div>
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{`${file.file_name}`}</div>
          <div className="text-xs text-gray-400">ID: {file.id}</div>
        </div>
        <button
          onClick={onOpen}
          className="px-3 py-1 text-xs rounded-md border border-white/15 text-gray-300 hover:text-white hover:border-white/30"
          title="Change dataset"
        >
          Change
        </button>
      </div>
    </div>
  );
}
