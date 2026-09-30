import { useEffect, useMemo, useState } from 'react'

const fallback = { generatedAt: null, sources: [] }

export function useOfficialOffers() {
  const [feed, setFeed] = useState(fallback)
  const [state, setState] = useState({ loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}offers.json`, { signal: controller.signal, cache: 'no-cache' })
        if (!response.ok) throw new Error('Tilbudsdata kunne ikke hentes')
        const next = await response.json()
        setFeed(next)
        setState({ loading: false, error: null })
      } catch (error) {
        if (error.name !== 'AbortError') setState({ loading: false, error: error.message })
      }
    }
    load()
    return () => controller.abort()
  }, [])

  const offers = useMemo(() => feed.sources.flatMap((source) => source.offers.map((offer) => ({
    ...offer,
    store: source.store,
    validFrom: source.validFrom,
    validTo: source.validTo,
    flyerUrl: source.flyerUrl,
  }))), [feed])

  return { ...state, ...feed, offers }
}
