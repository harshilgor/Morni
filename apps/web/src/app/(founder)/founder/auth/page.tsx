import { Suspense } from "react";
import { AuthForm } from "@/app/(shop)/auth/page";

export default function FounderAuthPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted">Loading…</div>}>
      <AuthForm />
    </Suspense>
  );
}
