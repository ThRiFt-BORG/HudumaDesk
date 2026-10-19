import type { ReactNode } from 'react'
import { Building2, ClipboardList, FilePlus2, LogOut, ShieldCheck } from 'lucide-react'
import type { DashboardPage, Profile } from '../types'

type DashboardShellProps = {
  profile: Profile
  email: string
  page: DashboardPage
  title: string
  subtitle: string
  onNavigate: (page: DashboardPage) => void
  onSignOut: () => void
  children: ReactNode
}

export default function DashboardShell({
  profile,
  email,
  page,
  title,
  subtitle,
  onNavigate,
  onSignOut,
  children,
}: DashboardShellProps) {
  const isAdmin = profile.role === 'admin'
  const links = isAdmin
    ? [{ id: 'admin' as const, label: 'Service desk', icon: ClipboardList }, { id: 'new-request' as const, label: 'Submit a request', icon: FilePlus2 }]
    : [{ id: 'requests' as const, label: 'My requests', icon: ClipboardList }, { id: 'new-request' as const, label: 'Submit a request', icon: FilePlus2 }]

  return (
    <div className="portal-layout">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/" aria-label="HudumaDesk home">
          <span className="brand-mark"><Building2 size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>HudumaDesk</strong><small>Murang’a County</small></span>
        </a>
        <div className="sidebar-divider" />
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onNavigate(id)} aria-current={page === id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <div className="help-icon"><ShieldCheck size={17} /></div>
          <strong>Need a hand?</strong>
          <p>Keep your reference number safe when following up.</p>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{(profile.full_name || email).charAt(0).toUpperCase()}</div>
          <div className="user-copy"><strong>{profile.full_name || 'Citizen'}</strong><small>{isAdmin ? 'Administrator' : 'Citizen account'}</small></div>
          <button className="icon-button logout-button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="mobile-brand"><span className="brand-mark"><Building2 size={19} /></span><strong>HudumaDesk</strong></div>
          <div className="topbar-location"><span className="live-dot" /> Murang’a County service portal</div>
          <div className="topbar-profile"><span className="topbar-name">{profile.full_name || email}</span><span className="avatar avatar-small">{(profile.full_name || email).charAt(0).toUpperCase()}</span></div>
        </header>

        <div className="mobile-nav" aria-label="Mobile navigation">
          {links.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => onNavigate(id)} aria-current={page === id ? 'page' : undefined}>
              <Icon size={16} />{label}
            </button>
          ))}
          <button onClick={onSignOut}><LogOut size={16} />Sign out</button>
        </div>

        <main className="page-content">
          <div className="page-heading">
            <div><div className="breadcrumb">PUBLIC SERVICE DESK <span>/</span> {isAdmin ? 'ADMIN' : 'CITIZEN'}</div><h1>{title}</h1><p>{subtitle}</p></div>
            <div className="verified-tag"><ShieldCheck size={15} /><span>{isAdmin ? 'Administrator access' : 'Private to your account'}</span></div>
          </div>
          {children}
        </main>
        <footer className="portal-footer"><span>© Murang’a County Government</span><span>Service with care <span className="footer-separator">·</span> HudumaDesk</span></footer>
      </div>
    </div>
  )
}
