import { SellShell } from "@/components/sell-shell";

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SellShell>{children}</SellShell>;
}
