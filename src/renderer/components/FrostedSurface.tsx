import type { PropsWithChildren } from 'react'

type FrostedSurfaceProps = PropsWithChildren<{
  title: string
}>

function FrostedSurface({ title, children }: FrostedSurfaceProps) {
  return (
    <section
      style={{
        background: 'var(--pf-bg-frosted)',
        border: '1px solid var(--pf-border-subtle)',
        borderRadius: 'var(--pf-radius-xl)',
        boxShadow: 'var(--pf-shadow-md)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        padding: 'var(--pf-space-24)',
        maxWidth: '720px',
        margin: 'var(--pf-space-32) auto'
      }}
    >
      <h1 style={{ margin: 0, marginBottom: 'var(--pf-space-16)' }}>{title}</h1>
      {children}
    </section>
  )
}

export default FrostedSurface
