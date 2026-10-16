// Royalty-free photography-themed images (Unsplash). Centralized so they are
// easy to swap later. Sizes are requested via query params to keep them light.
const unsplash = (id, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const IMAGES = {
  // Vintage camera on a desk — warm, professional.
  loginHero: unsplash('photo-1452587925148-ce544e77e70d'),
  // Wedding couple / event photography vibe for the dashboard banner.
  dashboardBanner: unsplash('photo-1519741497674-611481863552'),
}
