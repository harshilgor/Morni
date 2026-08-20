import { FounderWorkspace } from "@morni/founder/components/founder-workspace";
import { PortalWorkspace } from "@/components/portal-workspace";

export default function FounderPage() {
  return (
    <PortalWorkspace>
      <FounderWorkspace />
    </PortalWorkspace>
  );
}
