import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

type OrderStatusEmailProps = {
  name: string;
  orderNumber: string;
  statusLabel: string;
  statusMessage: string;
  orderUrl: string;
};

export function OrderStatusEmail({
  name,
  orderNumber,
  statusLabel,
  statusMessage,
  orderUrl,
}: OrderStatusEmailProps) {
  return (
    <MorniEmail
      preview={`Order ${orderNumber}: ${statusLabel}`}
      title={`Order ${statusLabel.toLowerCase()}`}
      action={{ label: "Track your order", href: orderUrl }}
    >
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        Your order <strong>{orderNumber}</strong> is now <strong>{statusLabel}</strong>.
      </Text>
      <Text style={emailStyles.text}>{statusMessage}</Text>
    </MorniEmail>
  );
}
