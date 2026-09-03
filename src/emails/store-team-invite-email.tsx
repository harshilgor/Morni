import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

export function StoreTeamInviteEmail({
  storeName,
  role,
  accessUrl,
}: {
  storeName: string;
  role: "manager" | "staff";
  accessUrl: string;
}) {
  const roleLabel = role === "manager" ? "Store Manager" : "Store Staff";
  return (
    <MorniEmail
      preview={`You have been invited to ${storeName} on Morni.`}
      eyebrow="Morni store team"
      title={`Join ${storeName}`}
      action={{ label: "Accept invitation", href: accessUrl }}
      highlights={[
        { title: roleLabel, body: role === "manager" ? "Manage products, orders, promotions and customer reviews." : "Help manage products, stock and order fulfilment." },
        { title: "Secure access", body: "This invitation is personal and expires in 7 days." },
      ]}
    >
      <Text style={emailStyles.text}>You have been invited to help run {storeName} on Morni. Sign in or create an account with this email address, then accept the invitation.</Text>
      <Text style={emailStyles.text}>If you were not expecting this invitation, you can safely ignore this email.</Text>
    </MorniEmail>
  );
}
