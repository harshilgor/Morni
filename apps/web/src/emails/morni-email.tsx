import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.morniuae.com";

const styles = {
  body: {
    backgroundColor: "#f8f7f4",
    color: "#1c1418",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: "0",
    padding: "32px 12px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #ead9df",
    maxWidth: "600px",
    margin: "0 auto",
  },
  header: {
    backgroundColor: "#1c1418",
    color: "#ffffff",
    padding: "24px 32px",
  },
  brand: {
    color: "#ffffff",
    fontFamily: "Georgia, serif",
    fontSize: "32px",
    lineHeight: "1",
    margin: "0",
  },
  content: {
    padding: "32px",
  },
  heading: {
    color: "#1c1418",
    fontFamily: "Georgia, serif",
    fontSize: "30px",
    fontWeight: "500",
    lineHeight: "1.2",
    margin: "0 0 16px",
  },
  text: {
    color: "#4f4146",
    fontSize: "16px",
    lineHeight: "1.65",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: "#c45b7a",
    borderRadius: "999px",
    boxSizing: "border-box" as const,
    color: "#ffffff",
    display: "block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "14px 22px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  divider: {
    borderColor: "#ead9df",
    borderStyle: "solid",
    margin: "28px 0",
  },
  footer: {
    color: "#76676d",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0",
    padding: "0 32px 30px",
  },
};

type MorniEmailProps = {
  preview: string;
  title: string;
  children: ReactNode;
  action?: { label: string; href: string };
};

export function MorniEmail({ preview, title, children, action }: MorniEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <p style={styles.brand}>Morni</p>
          </Section>
          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {title}
            </Heading>
            {children}
            {action ? (
              <Button href={action.href} style={styles.button}>
                {action.label}
              </Button>
            ) : null}
          </Section>
          <Hr style={styles.divider} />
          <Text style={styles.footer}>
            Morni brings local UAE fashion to your door. This is a transactional email
            about your Morni account or order. Visit{" "}
            <Link href={siteUrl} style={{ color: "#8f3d58" }}>
              morniuae.com
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = styles;
