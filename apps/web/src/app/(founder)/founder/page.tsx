import { redirect } from "next/navigation";
import { FounderWorkspace } from "@morni/founder/components/founder-workspace";
import { PortalWorkspace } from "@/components/portal-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function FounderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=%2Ffounder");

  return (
    <PortalWorkspace>
      <FounderWorkspace />
    </PortalWorkspace>
  );
}
