import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

type DeliveryInviteEmailProps = {
  partnerName: string;
  role: "dispatcher" | "driver";
  joinUrl: string;
};

export function DeliveryInviteEmail({
  partnerName,
  role,
  joinUrl,
}: DeliveryInviteEmailProps) {
  const roleLabel = role === "driver" ? "rider" : "dispatcher";

  return (
    <MorniEmail
      preview={`You’ve been invited to join ${partnerName} on Morni delivery.`}
      eyebrow="Welcome to Morni delivery"
      title={`You’re invited as a ${roleLabel}`}
      action={{ label: "Join Morni delivery", href: joinUrl }}
      highlights={[
        {
          title: "One secure link",
          body: "Use the button above to create or access your Morni delivery account.",
        },
        {
          title: "Your delivery team",
          body: `You’re joining ${partnerName}. The invite link works once and expires in 7 days.`,
        },
      ]}
    >
      <Text style={emailStyles.text}>
        {partnerName} has invited you to help with Morni deliveries. Once you
        join, you’ll be able to use the delivery workspace to receive and
        manage your assigned jobs.
      </Text>
      <Text style={emailStyles.text}>
        If you were not expecting this invitation, you can safely ignore this
        email.
      </Text>
    </MorniEmail>
  );
}
