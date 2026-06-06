export default function AALoading() {
  return (
    <div className="min-h-full">
      <div
        className="border-b h-[80px]"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'var(--bg-subtle)' }}
      />
      <div className="px-8 py-6 space-y-5" style={{ maxWidth: '1500px', margin: '0 auto' }}>
        <div className="grid grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border h-28 animate-pulse"
              style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
        <div className="rounded-xl border h-48 animate-pulse"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }} />
        <div className="rounded-xl border h-64 animate-pulse"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  )
}
