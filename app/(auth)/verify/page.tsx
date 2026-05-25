"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); return; }
    apiFetch<{ jwt: string }>(`/api/auth/verify?token=${token}`)
      .then((data) => {
        document.cookie = `bwf_token=${data.jwt}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        router.replace("/fixtures");
      })
      .catch(() => setStatus("error"));
  }, [params, router]);

  if (status === "error") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-5xl">❌</div>
        <h2 className="mb-2 text-xl font-bold">Invalid link</h2>
        <p className="mb-4 text-sm text-muted">This link has expired or already been used.</p>
        <a
          href="/login"
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-[#0f0f23]"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 text-5xl animate-spin">⚽</div>
      <p className="text-sm text-muted">Signing you in…</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
