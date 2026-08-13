import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

type WelcomeEmailProps = {
  name: string;
  ordersUrl: string;
};

export function WelcomeEmail({ name, ordersUrl }: WelcomeEmailProps) {
  return (
    <MorniEmail
      preview="Welcome to Morni — UAE boutiques, delivered locally."
      title={`Welcome to Morni, ${name}`}
      action={{ label: "Explore Morni", href: ordersUrl.replace("/orders", "/") }}
    >
      <Text style={emailStyles.text}>
        Your Morni account is ready. Discover boutiques near you and find pieces for
        every day, work, and special occasions.
      </Text>
      <Text style={emailStyles.text}>
        When you place an order, we’ll keep you updated from confirmation through
        delivery.
      </Text>
    </MorniEmail>
  );
}
