import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { getLogoDataUrl } from '../lib/logoCache'

const ProfileContext = createContext({ profile: null, loading: true, refresh: async () => {} })

// Loads the studio's business profile once and shares it app-wide (header, banner, PDFs).
export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    const { data } = await supabase.from('business_profile').select('*').limit(1).maybeSingle()
    setProfile(data || null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Cache the logo locally so PDF builds don't wait on it.
  useEffect(() => {
    if (profile?.logo_url) getLogoDataUrl(profile.logo_url)
  }, [profile?.logo_url])

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
