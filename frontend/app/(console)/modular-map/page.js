"use client";

import { useState } from "react";
import DatasetPickerModal from "@/app/components/ModularMap/DatasetPickerModal";
import DatasetSelectCard from "@/app/components/ModularMap/DatasetSelectCard";

export default function ModularMapPage() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="text-white">
      <main className="pt-8 min-h-screen bg-gray-900 px-8">
        <div className="grid grid-cols-4 gap-6">
          {/* Left Side */}
          <section className="md:col-span-1 h-[calc(100vh-5rem)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="h-full p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-200">Customize Settings</h2>

              {/* Only dataset picker for now */}
              <DatasetSelectCard
                file={selectedFile}
                onOpen={() => setPickerOpen(true)}
              />
            </div>
          </section>

          {/* Right Side (Map placeholder) - Jet's Task */}
          <section className="md:col-span-3 h-[calc(100vh-5rem)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="h-full p-4">
              <div className="relative h-full rounded-xl shimmer" />
            </div>
          </section>
        </div>

        <DatasetPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(f) => setSelectedFile(f)}  // store full file object {id, file_name, ...}
        />
      </main>
    </div>
  );
}
