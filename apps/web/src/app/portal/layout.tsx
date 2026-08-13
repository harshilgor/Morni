import { PortalNav } from "@/components/portal-nav";
import { PortalHeader } from "@/components/portal-header";
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
        <div className="min-w-0 flex-1">
          <PortalHeader />
          <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9">
            {children}
          </main>
        </div>
      </div>
    </PortalWorkspace>
  );
}
