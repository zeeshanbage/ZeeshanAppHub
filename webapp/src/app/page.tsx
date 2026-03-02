import AdminUploadForm from "@/components/UploadForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">

      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header/Brand */}
      <div className="w-full max-w-6xl flex justify-between items-center z-10 absolute top-0 pt-8 px-6 sm:px-12">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <h1 className="text-xl font-bold text-slate-200 tracking-tight">App Hub Admin</h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="z-10 w-full mt-16 sm:mt-0">
        <AdminUploadForm />
      </div>

    </main>
  );
}
