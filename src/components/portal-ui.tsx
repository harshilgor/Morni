import type { ReactNode } from "react";
import Link from "next/link";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import { orderStatusLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export function PortalPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="portal-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#17231f] sm:text-[2.15rem]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#596963]">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function PortalMetric({
  label,
  value,
  detail,
  tone = "default",
  icon,
  trend,
  sparkline,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: "default" | "urgent" | "success";
  icon?: PortalIconName;
  trend?: { value: string; direction: "up" | "down" | "neutral"; label: string } | null;
  sparkline?: number[];
}) {
  const toneClasses = {
    default: "bg-white",
    urgent: "border-[#efcfbf] bg-[#fff8f3]",
    success: "border-[#c8e0d6] bg-[#f5fbf8]",
  };
  return (
    <div className={`portal-card relative overflow-hidden p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="portal-eyebrow">{label}</p>
          <p className="mt-2 text-[1.75rem] font-bold leading-none tabular-nums tracking-[-0.045em] text-[#17231f]">{value}</p>
          {trend ? <p className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${trend.direction === "up" ? "text-[#237a57]" : trend.direction === "down" ? "text-[#b14d42]" : "text-[#687770]"}`}><span aria-hidden="true">{trend.direction === "up" ? "↗" : trend.direction === "down" ? "↘" : "—"}</span>{trend.value}<span className="font-medium text-[#687770]">{trend.label}</span></p> : detail ? <p className="mt-2 text-xs leading-5 text-[#687770]">{detail}</p> : null}
        </div>
        {icon ? <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3f0] text-[#3c685c]"><PortalIcon name={icon} /></span> : null}
      </div>
      {sparkline?.length ? <MetricSparkline values={sparkline} /> : null}
    </div>
  );
}

function MetricSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const width = 86;
  const height = 25;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 3 - (Math.max(value, 0) / max) * (height - 8);
    return `${x},${y}`;
  }).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="absolute bottom-3 right-4 h-7 w-[5.4rem] text-[#5b9183]" aria-hidden="true"><path d={`M0 ${height - 2} H${width}`} stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" /><polyline points={points} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

export function StatusBadge({ status }: { status: OrderStatus | "low_stock" | "live" | "paused" | "draft" }) {
  const styles: Record<string, string> = {
    placed: "bg-[#fff1dc] text-[#9c5b05] ring-[#f2d4a2]",
    accepted: "bg-[#e6f0ff] text-[#215d9f] ring-[#c5dcf7]",
    picking: "bg-[#eee9ff] text-[#5f4ca2] ring-[#d9ceff]",
    out_for_delivery: "bg-[#e2f6f1] text-[#17675b] ring-[#bde8dd]",
    delivered: "bg-[#e5f5eb] text-[#277044] ring-[#c9e7d4]",
    cancelled: "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]",
    low_stock: "bg-[#fff1dc] text-[#9c5b05] ring-[#f2d4a2]",
    live: "bg-[#e5f5eb] text-[#277044] ring-[#c9e7d4]",
    paused: "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]",
    draft: "bg-[#edf0ef] text-[#66736e] ring-[#dce3df]",
  };
  const labels: Record<string, string> = {
    low_stock: "Low stock",
    live: "Live",
    paused: "Paused",
    draft: "Needs setup",
  };
  return <span className={`inline-flex shrink-0 whitespace-nowrap items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-4 ring-1 ring-inset ${styles[status]}`}>{labels[status] ?? orderStatusLabel(status)}</span>;
}

export function PortalEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: PortalIconName;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="portal-card grid place-items-center px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf3f0] text-[#3c685c]"><PortalIcon name={icon} className="h-5 w-5" /></span>
      <h2 className="mt-4 text-base font-semibold text-[#17231f]">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[#596963]">{description}</p>
      {action ? <Link href={action.href} className="portal-button-primary mt-5">{action.label}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></Link> : null}
    </div>
  );
}

export function PortalSectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-[#17231f]">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-[#687770]">{description}</p> : null}
      </div>
      {action ? <Link href={action.href} className="portal-text-link">{action.label}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></Link> : null}
    </div>
  );
}
