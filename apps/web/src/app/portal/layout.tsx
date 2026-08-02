import { PortalNav } from "@/components/portal-nav";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col lg:flex-row">
      <PortalNav />
      <div className="flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
