import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

export function LifecycleEmail({
  name, orderNumber, preview, title, message, action,
}: {
  name: string; orderNumber: string; preview: string; title: string; message: string;
  action: { label: string; href: string };
}) {
  return <MorniEmail preview={preview} title={title} action={action}>
    <Text style={emailStyles.text}>Hi {name},</Text>
    <Text style={emailStyles.text}>This is an update about order <strong>{orderNumber}</strong>.</Text>
    <Text style={emailStyles.text}>{message}</Text>
  </MorniEmail>;
}
