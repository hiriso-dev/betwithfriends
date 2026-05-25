export default function VerifyPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 text-5xl">🔒</div>
      <h2 className="mb-2 text-xl font-bold">Magic links are disabled</h2>
      <p className="mb-4 text-sm text-muted">Use email and password to sign in.</p>
      <a
        href="/login"
        className="rounded-xl bg-accent px-6 py-3 font-semibold text-[#0f0f23]"
      >
        Go to login
      </a>
    </div>
  );
}
