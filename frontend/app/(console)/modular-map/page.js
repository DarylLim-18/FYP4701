"use client";
export default function ModularMapPage() {
    return (
        <div className="text-white">
            <main className="pt-8 min-h-screen bg-gray-900 px-8">
                <div className="grid grid-cols-4 gap-6">
                    {/* Left Side */}
                    <section className="md:col-span-1 h-[calc(100vh-5rem)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
                        <div className="h-full p-4">
                            <h2 className="text-sm font-semibold text-gray-200 mb-3">Customize Settings</h2>
                            <div className="relative h-full rounded-xl" />
                        </div>
                    </section>

                    {/* Right Side (Jet should take care of this) */}
                    <section className="md:col-span-3 h-[calc(100vh-5rem)] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
                        <div className="h-full p-4">
                            <div className="relative h-full rounded-xl shimmer" />
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
