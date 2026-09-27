import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

export function CartReminderEmail({
  name,
  itemNames,
  itemCount,
  cartUrl,
}: {
  name: string;
  itemNames: string[];
  itemCount: number;
  cartUrl: string;
}) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const summary = itemNames.length
    ? itemNames.slice(0, 3).join(", ")
    : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <MorniEmail
      preview="You left something in your Morni bag."
      eyebrow="Your bag is waiting"
      title={`Still thinking it over, ${firstName}?`}
      action={{ label: "Return to your bag", href: cartUrl }}
    >
      <Text style={emailStyles.text}>
        You have {itemCount} {itemCount === 1 ? "item" : "items"} waiting in
        your bag: {summary}{itemCount > 3 ? " and more" : ""}.
      </Text>
      <Text style={emailStyles.text}>
        Your bag is ready whenever you are. Head back to Morni to review your
        picks and complete checkout.
      </Text>
    </MorniEmail>
  );
}
