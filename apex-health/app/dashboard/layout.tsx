import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <DashboardNav />
      <main className="min-w-0 flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
