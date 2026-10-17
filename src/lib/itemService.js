import { supabase } from './supabase'

const STORAGE_KEY = 'user_dynamic_items_catalog'

/**
 * Loads items 100% dynamically from:
 * 1. Supabase `items` table (user's saved items)
 * 2. Previous invoices `items` jsonb (items previously used and saved)
 * 3. Previous quotations `items` jsonb
 * 4. User's local storage catalog
 *
 * No hardcoded items. Returns only what has actually been created or used.
 */
export async function loadItemsLibrary() {
  const itemMap = new Map()

  // Clean up any old hardcoded starter cache from previous versions
  try {
    localStorage.removeItem('studio_items_library')
  } catch {
    // ignore
  }

  // 1. Load from user's dynamic local storage
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(cached)) {
      cached.forEach((it) => {
        if (it?.name?.trim()) {
          itemMap.set(it.name.trim().toLowerCase(), {
            id: it.id || undefined,
            name: it.name.trim(),
            unit: it.unit || 'Photo',
            rate: Number(it.rate) || 0,
          })
        }
      })
    }
  } catch {
    // Ignore JSON parse error
  }

  // 2. Load from Supabase (Database tables)
  if (supabase) {
    try {
      // 2A. From dedicated `items` table if it exists
      const { data: dbItems, error: itemsErr } = await supabase
        .from('items')
        .select('*')
        .order('name')

      if (!itemsErr && Array.isArray(dbItems)) {
        dbItems.forEach((it) => {
          if (it.name?.trim()) {
            itemMap.set(it.name.trim().toLowerCase(), {
              id: it.id,
              name: it.name.trim(),
              unit: it.unit || 'Photo',
              rate: Number(it.rate) || 0,
            })
          }
        })
      }
    } catch {
      // items table may not exist yet in Supabase
    }

    try {
      // 2B. From past saved invoices
      const { data: invs } = await supabase
        .from('invoices')
        .select('items')
        .order('created_at', { ascending: false })
        .limit(100)

      if (Array.isArray(invs)) {
        invs.forEach((inv) => {
          if (Array.isArray(inv.items)) {
            inv.items.forEach((it) => {
              const name = (it.description || it.name || '').trim()
              if (name) {
                const key = name.toLowerCase()
                const existing = itemMap.get(key)
                itemMap.set(key, {
                  id: existing?.id,
                  name: existing?.name || name,
                  unit: it.unit || existing?.unit || 'Photo',
                  rate: Number(it.rate) || existing?.rate || 0,
                })
              }
            })
          }
        })
      }
    } catch {
      // Ignore
    }

    try {
      // 2C. From past saved quotations
      const { data: quotes } = await supabase
        .from('quotations')
        .select('items')
        .order('created_at', { ascending: false })
        .limit(50)

      if (Array.isArray(quotes)) {
        quotes.forEach((q) => {
          if (Array.isArray(q.items)) {
            q.items.forEach((it) => {
              const name = (it.description || it.name || '').trim()
              if (name) {
                const key = name.toLowerCase()
                const existing = itemMap.get(key)
                itemMap.set(key, {
                  id: existing?.id,
                  name: existing?.name || name,
                  unit: it.unit || existing?.unit || 'Photo',
                  rate: Number(it.rate) || existing?.rate || 0,
                })
              }
            })
          }
        })
      }
    } catch {
      // Ignore
    }
  }

  const result = Array.from(itemMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  // Persist synced items back to local dynamic cache
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
  } catch {
    // Ignore storage quota
  }

  return result
}

/**
 * Saves or updates newly used items to the library.
 * Persists to localStorage and syncs with Supabase `items` table.
 */
export async function saveItemsToLibrary(items) {
  if (!Array.isArray(items) || items.length === 0) return

  // 1. Update dynamic localStorage
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const map = new Map(existing.map((x) => [x.name.toLowerCase(), x]))

    items.forEach((it) => {
      const name = (it.description || it.name || '').trim()
      if (!name) return
      const key = name.toLowerCase()
      map.set(key, {
        name,
        unit: it.unit || 'Photo',
        rate: Number(it.rate) || 0,
      })
    })

    const updated = Array.from(map.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore local storage error
  }

  // 2. Persist to Supabase `items` table if connected
  if (supabase) {
    try {
      const rows = items
        .filter((it) => (it.description || it.name || '').trim())
        .map((it) => ({
          name: (it.description || it.name).trim(),
          unit: it.unit || 'Photo',
          rate: Number(it.rate) || 0,
        }))

      for (const row of rows) {
        const { data: existing } = await supabase
          .from('items')
          .select('id')
          .ilike('name', row.name)
          .maybeSingle()

        if (existing?.id) {
          await supabase
            .from('items')
            .update({ unit: row.unit, rate: row.rate })
            .eq('id', existing.id)
        } else {
          await supabase.from('items').insert(row)
        }
      }
    } catch {
      // Table may not exist yet or offline, local storage already cached it
    }
  }
}
