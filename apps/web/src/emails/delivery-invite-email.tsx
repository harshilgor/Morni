import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

type DeliveryInviteEmailProps = {
  partnerName: string;
  role: "dispatcher" | "driver";
  accessUrl: string;
};

export function DeliveryInviteEmail({
  partnerName,
  role,
  accessUrl,
}: DeliveryInviteEmailProps) {
  const roleLabel = role === "driver" ? "rider" : "dispatcher";

  return (
    <MorniEmail
      preview="Your one-tap Morni delivery access link is ready."
      eyebrow="Welcome to Morni delivery"
      title={`Start delivering as a ${roleLabel}`}
      action={{ label: "Open Morni Rider", href: accessUrl }}
      highlights={[
        {
          title: "One-tap access",
          body: "Use the button above to securely sign in or create your Morni delivery account.",
        },
        {
          title: "Your delivery team",
          body: `You’re joining ${partnerName}. This secure link works once and expires in 7 days.`,
        },
      ]}
    >
      <Text style={emailStyles.text}>
        {partnerName} has invited you to help with Morni deliveries. Tap the
        button above to get straight into your delivery workspace and manage
        assigned jobs.
      </Text>
      <Text style={emailStyles.text}>
        If you were not expecting this invitation, you can safely ignore this
        email.
      </Text>
    </MorniEmail>
  );
}
