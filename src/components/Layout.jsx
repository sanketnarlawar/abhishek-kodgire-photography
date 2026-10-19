import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import GlobalSearch from './GlobalSearch'
import logoBlack from '../images/logo-black.png'
import logoWhite from '../images/logo-white.png'
import {
  CameraIcon,
  DashboardIcon,
  InvoiceIcon,
  QuoteIcon,
  ClientIcon,
  PackageIcon,
  ExpenseIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  ChevronLeftIcon,
  PlusIcon,
} from './icons'

const navItems = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/invoices', label: 'Invoices', icon: InvoiceIcon },
  { to: '/quotations', label: 'Quotations', icon: QuoteIcon },
  { to: '/clients', label: 'Clients', icon: ClientIcon },
  { to: '/packages', label: 'Packages', icon: PackageIcon },
  { to: '/expenses', label: 'Expenses', icon: ExpenseIcon },
  { to: '/settings', label: 'Business Profile', icon: SettingsIcon },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Layout({ children }) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const searchRef = useRef(null)

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Keyboard shortcuts: "/" focuses search, "n" opens a new invoice.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key.toLowerCase() === 'n') {
        navigate('/invoices/new')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const studioName =
    profile?.studio_name && profile.studio_name !== 'Abhishek Kodgire Photography & Films'
      ? profile.studio_name
      : 'Abhishek Kodgire photoStudio'

  const NavList = ({ showLabels }) => (
    <nav className="flex-1 space-y-1">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={showLabels ? undefined : label}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${showLabels ? '' : 'justify-center'
            } ${isActive
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <Icon />
          {showLabels && label}
        </NavLink>
      ))}
    </nav>
  )

  const Brand = ({ showText }) => (
    <Link to="/" className="flex min-w-0 items-center gap-2 px-1" title={studioName}>
      {profile?.logo_url ? (
        <>
          <img src={profile.logo_url} alt="Logo" className="h-8 w-8 shrink-0 rounded object-contain" />
          {showText && (
            <span className="truncate text-base font-bold text-white" title={studioName}>
              {studioName}
            </span>
          )}
        </>
      ) : showText ? (
        <div className="flex items-center py-0.5">
          <img
            src={logoWhite}
            alt="Abhishek Kodgire Photography & Film's"
            className="h-11 w-auto max-w-[185px] object-contain"
          />
        </div>
      ) : (
        <span className="shrink-0 text-gray-300">
          <CameraIcon width={28} height={28} />
        </span>
      )}
    </Link>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — always dark */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-gray-800 bg-gray-900 p-4 transition-all md:flex ${collapsed ? 'w-20' : 'w-64'
          }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <Brand showText={!collapsed} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeftIcon
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
              width={18}
              height={18}
            />
          </button>
        </div>
        <NavList showLabels={!collapsed} />
        <button
          onClick={handleSignOut}
          className={`mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-800 hover:text-white ${collapsed ? 'justify-center' : 'justify-start'
            }`}
          title="Sign out"
        >
          <LogoutIcon /> {!collapsed && 'Sign out'}
        </button>

        {!collapsed ? (
          <div className="mt-3 border-t border-gray-800/80 pt-3 text-center">
            <p className="text-xs text-gray-500">
              Developed by <span className="font-medium text-gray-300">Sanket Narlawar</span>
            </p>
          </div>
        ) : (
          <div className="mt-3 border-t border-gray-800/80 pt-2 text-center" title="Developed by Sanket Narlawar">
            <span className="text-[10px] font-medium text-gray-500">SN</span>
          </div>
        )}
      </aside>

      {/* Mobile drawer — always dark */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-gray-800 bg-gray-900 p-4 shadow-xl animate-pop-in">
            <div className="mb-6 flex items-center justify-between">
              <Brand showText />
              <button onClick={() => setMobileOpen(false)} className="text-gray-500 hover:text-gray-300">
                <CloseIcon />
              </button>
            </div>
            <NavList showLabels />
            <button
              onClick={handleSignOut}
              className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-800 hover:text-white justify-start"
            >
              <LogoutIcon /> Sign out
            </button>

            <div className="mt-3 border-t border-gray-800/80 pt-3 text-center">
              <p className="text-xs text-gray-500">
                Developed by <span className="font-medium text-gray-300">Sanket Narlawar</span>
              </p>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
          >
            <MenuIcon />
          </button>

          <div className="hidden min-w-0 md:block">
            <p className="text-sm font-semibold leading-tight">
              {greeting()}
              {profile?.studio_name ? `, ${profile.studio_name}` : ''}
            </p>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>

          <div className="flex flex-1 justify-center md:px-4">
            <GlobalSearch inputRef={searchRef} />
          </div>

          <Link
            to="/invoices/new"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
            title="New Invoice / Add Sale"
          >
            <PlusIcon width={16} height={16} />
            <span className="hidden sm:inline">Add Sale</span>
          </Link>

          <button onClick={toggleTheme} className="btn-secondary" title="Toggle dark mode">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <main
          key={location.pathname}
          className="app-bg flex-1 animate-fade-in overflow-x-hidden p-4 md:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
