import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.morniuae.com";
export const logoUrl = `${siteUrl}/brand/morni-logo.png`;

const styles = {
  body: {
    backgroundColor: "#f4f0ec",
    backgroundImage:
      "radial-gradient(ellipse at top left, rgba(47,111,102,0.08), transparent 50%), radial-gradient(ellipse at top right, rgba(196,91,122,0.10), transparent 45%)",
    color: "#1c1418",
    fontFamily:
      "ui-rounded, 'Nunito Sans', 'Segoe UI', Arial, Helvetica, sans-serif",
    margin: "0",
    padding: "40px 12px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #ead9df",
    borderRadius: "20px",
    maxWidth: "600px",
    margin: "0 auto",
    overflow: "hidden" as const,
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #f0e4e8",
    padding: "28px 32px 20px",
    textAlign: "center" as const,
  },
  logo: {
    display: "block",
    margin: "0 auto",
    width: "132px",
    height: "132px",
  },
  heroBand: {
    backgroundColor: "#2a1f24",
    backgroundImage:
      "linear-gradient(135deg, #2a1f24 0%, #3d2a32 55%, #2f6f66 140%)",
    padding: "28px 32px",
  },
  heroEyebrow: {
    color: "#d4b07a",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.16em",
    margin: "0 0 10px",
    textTransform: "uppercase" as const,
  },
  content: {
    padding: "32px",
  },
  heading: {
    color: "#1c1418",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "28px",
    fontWeight: "500",
    lineHeight: "1.25",
    margin: "0 0 16px",
  },
  text: {
    color: "#4f4146",
    fontSize: "16px",
    lineHeight: "1.65",
    margin: "0 0 16px",
  },
  highlightRow: {
    margin: "8px 0 24px",
  },
  highlightCard: {
    backgroundColor: "#fff7f4",
    border: "1px solid #ead9df",
    borderRadius: "14px",
    marginBottom: "10px",
    padding: "14px 16px",
  },
  highlightTitle: {
    color: "#1c1418",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1.4",
    margin: "0 0 4px",
  },
  highlightBody: {
    color: "#6b5a60",
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "0",
  },
  button: {
    backgroundColor: "#8f3d58",
    borderRadius: "999px",
    boxSizing: "border-box" as const,
    color: "#ffffff",
    display: "block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "15px 24px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  divider: {
    borderColor: "#ead9df",
    borderStyle: "solid",
    margin: "8px 0 0",
  },
  footer: {
    color: "#76676d",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0",
    padding: "22px 32px 28px",
  },
};

type Highlight = {
  title: string;
  body: string;
};

type MorniEmailProps = {
  preview: string;
  title: string;
  children: ReactNode;
  action?: { label: string; href: string };
  eyebrow?: string;
  highlights?: Highlight[];
};

export function MorniEmail({
  preview,
  title,
  children,
  action,
  eyebrow,
  highlights,
}: MorniEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={logoUrl}
              width="132"
              height="132"
              alt="Morni"
              style={styles.logo}
            />
          </Section>

          {eyebrow ? (
            <Section style={styles.heroBand}>
              <Text style={styles.heroEyebrow}>{eyebrow}</Text>
              <Heading
                as="h1"
                style={{
                  ...styles.heading,
                  color: "#ffffff",
                  margin: "0",
                  fontSize: "26px",
                }}
              >
                {title}
              </Heading>
            </Section>
          ) : null}

          <Section style={styles.content}>
            {!eyebrow ? (
              <Heading as="h1" style={styles.heading}>
                {title}
              </Heading>
            ) : null}
            {children}
            {highlights?.length ? (
              <Section style={styles.highlightRow}>
                {highlights.map((item) => (
                  <Section key={item.title} style={styles.highlightCard}>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightBody}>{item.body}</Text>
                  </Section>
                ))}
              </Section>
            ) : null}
            {action ? (
              <Button href={action.href} style={styles.button}>
                {action.label}
              </Button>
            ) : null}
          </Section>
          <Hr style={styles.divider} />
          <Text style={styles.footer}>
            Morni brings local UAE fashion to your door. This is a transactional
            email about your Morni account or order. Visit{" "}
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
