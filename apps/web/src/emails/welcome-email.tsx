import { Text } from "react-email";
import { MorniEmail, emailStyles } from "./morni-email";

type WelcomeEmailProps = {
  name: string;
  ordersUrl: string;
};

export function WelcomeEmail({ name, ordersUrl }: WelcomeEmailProps) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  const homeUrl = ordersUrl.replace(/\/orders\/?$/, "/") || "https://www.morniuae.com/";

  return (
    <MorniEmail
      preview={`You’re in, ${firstName} — UAE boutiques, delivered to your door.`}
      eyebrow="Welcome to the flock"
      title={`Hey ${firstName}, your Morni account is ready`}
      action={{ label: "Start exploring boutiques", href: homeUrl }}
      highlights={[
        {
          title: "Boutiques near you",
          body: "Browse curated local fashion — kurtis, sets, jewelry, and more from UAE makers.",
        },
        {
          title: "Doorstep delivery",
          body: "Order what you love and we’ll bring it to you across Dubai.",
        },
        {
          title: "Live order updates",
          body: "From confirmation to out-for-delivery, we’ll keep you in the loop by email.",
        },
      ]}
    >
      <Text style={emailStyles.text}>
        Something special is waiting. Morni connects you with independent UAE
        boutiques so finding your next favourite piece feels effortless — and a
        little exciting.
      </Text>
      <Text style={emailStyles.text}>
        Dive in, save what you love, and when you’re ready, checkout takes just a
        moment.
      </Text>
    </MorniEmail>
  );
}
