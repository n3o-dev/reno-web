export default function Unauthorized() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-[28px]">Link no longer works</h1>
      <p className="mt-2 text-[14px] text-muted">
        This link has been revoked or was never valid. Ask Reno for a new one.
      </p>
    </main>
  )
}
