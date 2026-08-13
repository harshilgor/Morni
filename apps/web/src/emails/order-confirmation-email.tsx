import { Hr, Section, Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

export type EmailOrderItem = {
  title: string;
  quantity: number;
  size: string | null;
  colorName: string | null;
  lineTotal: string;
};

type OrderConfirmationEmailProps = {
  name: string;
  orderNumber: string;
  storeName: string;
  total: string;
  deliveryArea: string;
  deliveryEta: string;
  items: EmailOrderItem[];
  orderUrl: string;
};

export function OrderConfirmationEmail({
  name,
  orderNumber,
  storeName,
  total,
  deliveryArea,
  deliveryEta,
  items,
  orderUrl,
}: OrderConfirmationEmailProps) {
  return (
    <MorniEmail
      preview={`Your order ${orderNumber} has been received.`}
      title="Your order is confirmed"
      action={{ label: "View your order", href: orderUrl }}
    >
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        {storeName} has received order <strong>{orderNumber}</strong>. We’ll let you
        know as soon as it moves.
      </Text>
      <Section
        style={{
          backgroundColor: "#fff7f4",
          border: "1px solid #ead9df",
          padding: "18px",
        }}
      >
        {items.map((item) => (
          <Text key={`${item.title}-${item.size ?? ""}-${item.colorName ?? ""}`} style={{ ...emailStyles.text, margin: "0 0 10px" }}>
            <strong>{item.quantity}× {item.title}</strong>
            {item.colorName ? ` · ${item.colorName}` : ""}
            {item.size ? ` · Size ${item.size}` : ""}
            <br />
            {item.lineTotal}
          </Text>
        ))}
      </Section>
      <Hr style={emailStyles.divider} />
      <Text style={emailStyles.text}>
        <strong>Total: {total}</strong>
        <br />
        Delivering to {deliveryArea} · {deliveryEta}
      </Text>
    </MorniEmail>
  );
}
