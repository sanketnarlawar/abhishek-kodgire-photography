import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { PageLoader } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useProfile } from '../contexts/ProfileContext'

const emptyProfile = {
  studio_name: '',
  phone: '',
  email: '',
  address: '',
  upi_id: '',
  upi_payee_name: '',
  logo_url: '',
  terms: '',
  invoice_prefix: 'INV',
  quotation_prefix: 'QT',
}

export default function Settings() {
  const { notify } = useToast()
  const { refresh } = useProfile()
  const [profile, setProfile] = useState(emptyProfile)
  const [profileId, setProfileId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('business_profile')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile({ ...emptyProfile, ...data })
          setProfileId(data.id)
        }
        setLoading(false)
      })
  }, [])

  const handleLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      notify('Please choose a logo smaller than 500 KB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setProfile((p) => ({ ...p, logo_url: reader.result }))
    reader.readAsDataURL(file)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { id, created_at, owner_id, ...payload } = profile
    if (profileId) {
      await supabase.from('business_profile').update(payload).eq('id', profileId)
    } else {
      const { data } = await supabase.from('business_profile').insert(payload).select().single()
      if (data) setProfileId(data.id)
    }
    setSaving(false)
    notify('Business profile saved')
    refresh()
  }

  if (loading) return <PageLoader />

  return (
    <div className="max-w-2xl">
      <PageHeader title="Business Profile" subtitle="Branding and details shown on invoices & quotations" />

      <form onSubmit={save} className="card space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
            )}
          </div>
          <div>
            <label className="label">Studio Logo</label>
            <input type="file" accept="image/*" onChange={handleLogo} className="text-sm" />
            {profile.logo_url && (
              <button
                type="button"
                onClick={() => setProfile({ ...profile, logo_url: '' })}
                className="ml-2 text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label">Studio Name *</label>
          <input
            required
            className="input"
            value={profile.studio_name}
            onChange={(e) => setProfile({ ...profile, studio_name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <textarea
            rows={2}
            className="input"
            value={profile.address}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">UPI ID (for payments)</label>
            <input
              className="input"
              placeholder="name@bank"
              value={profile.upi_id}
              onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
            />
          </div>
          <div>
            <label className="label">UPI Payee Name</label>
            <input
              className="input"
              placeholder="Name shown in UPI apps"
              value={profile.upi_payee_name}
              onChange={(e) => setProfile({ ...profile, upi_payee_name: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Invoice Number Prefix</label>
            <input
              className="input"
              value={profile.invoice_prefix}
              onChange={(e) => setProfile({ ...profile, invoice_prefix: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Quotation Number Prefix</label>
            <input
              className="input"
              value={profile.quotation_prefix}
              onChange={(e) => setProfile({ ...profile, quotation_prefix: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">Terms & Conditions</label>
          <textarea
            rows={3}
            className="input"
            placeholder="Payment terms, cancellation policy, etc."
            value={profile.terms}
            onChange={(e) => setProfile({ ...profile, terms: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
