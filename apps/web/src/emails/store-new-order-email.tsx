import { Hr, Section, Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";
import type { EmailOrderItem } from "./order-confirmation-email";

type StoreNewOrderEmailProps = {
  name: string;
  orderNumber: string;
  storeName: string;
  total: string;
  deliveryArea: string;
  deliveryPhone: string | null;
  items: EmailOrderItem[];
  portalOrdersUrl: string;
};

export function StoreNewOrderEmail({
  name,
  orderNumber,
  storeName,
  total,
  deliveryArea,
  deliveryPhone,
  items,
  portalOrdersUrl,
}: StoreNewOrderEmailProps) {
  return (
    <MorniEmail
      preview={`New order ${orderNumber} for ${storeName}`}
      eyebrow="New order"
      title={`Order ${orderNumber} just came in`}
      action={{ label: "Open orders in portal", href: portalOrdersUrl }}
    >
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        A shopper placed a new order at <strong>{storeName}</strong>. Accept it in
        your portal to start preparing.
      </Text>
      <Section
        style={{
          backgroundColor: "#fff7f4",
          border: "1px solid #ead9df",
          padding: "18px",
        }}
      >
        {items.map((item) => (
          <Text
            key={`${item.title}-${item.size ?? ""}-${item.colorName ?? ""}`}
            style={{ ...emailStyles.text, margin: "0 0 10px" }}
          >
            <strong>
              {item.quantity}× {item.title}
            </strong>
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
        Delivering to {deliveryArea}
        {deliveryPhone ? (
          <>
            <br />
            Shopper phone: {deliveryPhone}
          </>
        ) : null}
      </Text>
    </MorniEmail>
  );
}
