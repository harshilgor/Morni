"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalEmpty, PortalPageHeader } from "@/components/portal-ui";
import { useOwnerStore } from "@/lib/use-owner-store";
import type { StoreMemberRole } from "@/lib/types";

type Member = { id: string; userId: string; role: StoreMemberRole; createdAt: string; name: string | null; email: string };
type Invite = { id: string; email: string; role: "manager" | "staff"; expires_at: string; created_at: string };

const roleName: Record<StoreMemberRole, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export default function PortalTeamPage() {
  const { store, loading, error, storeRole } = useOwnerStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!store || storeRole !== "owner") return;
    const response = await fetch(`/api/portal/team?storeId=${store.id}`);
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Could not load the store team."); return; }
    setMembers(data.members ?? []);
    setInvites(data.invites ?? []);
  }, [store, storeRole]);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!store) return;
    setSaving(true); setMessage(null); setInviteUrl(null);
    const response = await fetch("/api/portal/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store.id, email, role }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "Could not send invitation."); return; }
    setEmail(""); setInviteUrl(data.accessUrl ?? null);
    setMessage(data.emailSent ? "Invitation email sent." : "Invitation created, but the email could not be sent. Copy the secure link below.");
    await load();
  }

  async function mutate(method: "PATCH" | "DELETE", body: Record<string, string>) {
    if (!store) return;
    setSaving(true); setMessage(null);
    const response = await fetch("/api/portal/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store.id, ...body }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "Could not update team access."); return; }
    await load();
  }

  if (error === "unauthenticated") return <PortalEmpty icon="team" title="Sign in to manage team access" description="Use the store owner account to invite your staff." action={{ label: "Sign in", href: "/auth?next=/portal/team" }} />;
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) return <PortalEmpty icon="store" title="Set up a store first" description="Create a store before inviting your team." action={{ label: "Start store setup", href: "/sell/setup" }} />;
  if (storeRole !== "owner") return <PortalEmpty icon="team" title="Owner access required" description="Only the store owner can invite, remove, or change team access. Ask the owner to make any changes." />;

  return <div className="max-w-5xl">
    <PortalPageHeader eyebrow="Store management" title="Team access" description="Invite the people who run your store. Each person uses their own Morni account, so access stays traceable and can be removed at any time." />
    <section className="portal-card mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[#1d2925]">Invite a teammate</h2>
      <p className="mt-1 text-sm text-[#687770]">Managers can manage products, orders, promotions and reviews. Staff can work on products, stock and fulfilment. Only you can manage this team or store settings.</p>
      <form onSubmit={invite} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <input className="portal-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@email.com" required />
        <select className="portal-input" value={role} onChange={(event) => setRole(event.target.value as "manager" | "staff")}>{["staff", "manager"].map((value) => <option key={value} value={value}>{roleName[value as "staff" | "manager"]}</option>)}</select>
        <button className="portal-button-primary justify-center disabled:opacity-50" disabled={saving}>{saving ? "Sending…" : "Send invite"}</button>
      </form>
      {message ? <p className="mt-3 text-sm text-[#315f54]">{message}</p> : null}
      {inviteUrl ? <div className="mt-3 rounded-xl border border-[#e4cfa7] bg-[#fff9ec] p-3"><p className="text-xs text-[#755425]">Secure invitation link — share it only with the intended teammate. It expires in 7 days.</p><div className="mt-2 flex gap-2"><input className="portal-input min-w-0 flex-1 bg-white text-xs" value={inviteUrl} readOnly /><button type="button" className="rounded-lg border border-[#cab887] px-3 text-xs font-semibold text-[#66522b]" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy</button></div></div> : null}
    </section>
    <section className="portal-card mt-5 overflow-hidden"><div className="border-b border-[#edf1ef] px-5 py-4"><h2 className="text-lg font-semibold text-[#1d2925]">People with access</h2></div><div className="divide-y divide-[#edf1ef]">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#263530]">{member.name || member.email}</p><p className="truncate text-xs text-[#7b8882]">{member.email}</p></div>{member.role === "owner" ? <span className="rounded-full bg-[#e7f2ed] px-3 py-1.5 text-xs font-semibold text-[#2e6a5a]">Owner</span> : <select aria-label={`Role for ${member.email}`} className="rounded-lg border border-[#dce5e0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#40534d]" value={member.role} disabled={saving} onChange={(event) => void mutate("PATCH", { memberId: member.id, role: event.target.value })}><option value="staff">Staff</option><option value="manager">Manager</option></select>} {member.role !== "owner" ? <button type="button" disabled={saving} className="text-xs font-semibold text-[#a84948] hover:underline disabled:opacity-50" onClick={() => void mutate("DELETE", { memberId: member.id })}>Remove</button> : null}</div>)}</div></section>
    <section className="portal-card mt-5 overflow-hidden"><div className="border-b border-[#edf1ef] px-5 py-4"><h2 className="text-lg font-semibold text-[#1d2925]">Pending invitations</h2></div>{invites.length ? <div className="divide-y divide-[#edf1ef]">{invites.map((invite) => <div key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#263530]">{invite.email}</p><p className="text-xs text-[#7b8882]">{roleName[invite.role]} · expires {new Date(invite.expires_at).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}</p></div><button type="button" disabled={saving} className="text-xs font-semibold text-[#a84948] hover:underline disabled:opacity-50" onClick={() => void mutate("DELETE", { inviteId: invite.id })}>Revoke</button></div>)}</div> : <p className="px-5 py-5 text-sm text-[#7b8882]">No invitations are waiting to be accepted.</p>}</section>
  </div>;
}
