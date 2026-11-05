const KEY = 'pdfLogoCache'

// Returns a data URL for the remote logo so PDF builds don't wait on the network.
export async function getLogoDataUrl(url) {
  if (!url || url.startsWith('data:')) return url
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (cached?.url === url) return cached.data
  } catch {
    // Corrupt cache entry; refetch below.
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    try {
      localStorage.setItem(KEY, JSON.stringify({ url, data }))
    } catch {
      // Quota exceeded; the data URL is still usable for this build.
    }
    return data
  } catch {
    return url
  }
}
