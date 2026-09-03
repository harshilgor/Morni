import { PortalNav } from "@/components/portal-nav";
import { PortalHeader } from "@/components/portal-header";
import { PortalBottomNav } from "@/components/portal-bottom-nav";
import { PortalWorkspace } from "@/components/portal-workspace";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalWorkspace>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <PortalNav />
        <div className="min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          <PortalHeader />
          <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-7 lg:px-9 lg:py-9">
            {children}
          </main>
        </div>
      </div>
      <PortalBottomNav />
    </PortalWorkspace>
  );
}
