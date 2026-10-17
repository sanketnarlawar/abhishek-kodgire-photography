import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from '../components/Loaders'
import { CameraIcon } from '../components/icons'
import { IMAGES } from '../lib/images'

export default function Login() {
  const { user, signIn, signUp, resetPassword, updatePassword, passwordRecovery } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // 'reset' = choosing a new password after opening the emailed link
  const view = passwordRecovery ? 'reset' : mode

  if (user && !passwordRecovery) return <Navigate to="/" replace />

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (view === 'reset' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const fn =
      view === 'forgot' ? () => resetPassword(email)
      : view === 'reset' ? () => updatePassword(password)
      : view === 'signin' ? () => signIn(email, password)
      : () => signUp(email, password)
    const { error } = await fn()
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (view === 'forgot') {
      setInfo('If an account exists for this email, a password reset link has been sent. Check your inbox.')
    }
    if (view === 'signup') {
      setInfo('Account created. If email confirmation is enabled, check your inbox, then sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 font-modern">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${IMAGES.loginHero})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-gray-900/80 to-black/85" />
      <div className="relative w-full max-w-sm animate-pop-in">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg ring-4 ring-white/20">
            <CameraIcon width={34} height={34} />
          </span>
          <h1 className="font-brand text-3xl font-semibold leading-tight text-white drop-shadow-md">
            Abhishek Kodgire
            <span className="mt-1.5 block font-modern text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-100">
              Photography &amp; Films
            </span>
          </h1>
          <p className="text-sm text-gray-200">
            {view === 'signin' && 'Sign in to your studio'}
            {view === 'signup' && 'Create your studio account'}
            {view === 'forgot' && 'Enter your email to reset your password'}
            {view === 'reset' && 'Choose a new password'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 shadow-2xl">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {info}
            </div>
          )}
          {view !== 'reset' && (
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          )}
          {view !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="label">{view === 'reset' ? 'New password' : 'Password'}</label>
                {view === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="mb-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          {view === 'reset' && (
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Spinner size={16} /> Please wait…
              </>
            ) : view === 'signin' ? (
              'Sign in'
            ) : view === 'signup' ? (
              'Create account'
            ) : view === 'forgot' ? (
              'Send reset link'
            ) : (
              'Update password'
            )}
          </button>
          {view !== 'reset' && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              {view === 'signin' && "Don't have an account? "}
              {view === 'signup' && 'Already have an account? '}
              {view === 'forgot' && 'Remembered your password? '}
              <button
                type="button"
                onClick={() => switchMode(view === 'signin' ? 'signup' : 'signin')}
                className="font-medium text-brand-600 hover:underline"
              >
                {view === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
