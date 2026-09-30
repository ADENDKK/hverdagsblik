import { useEffect, useState } from 'react'

export function usePwaInstall() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

  useEffect(() => {
    const beforeInstall = (event) => { event.preventDefault(); setPrompt(event) }
    const appInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', appInstalled) }
  }, [])

  const install = async () => {
    if (!prompt) return false
    await prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') setPrompt(null)
    return result.outcome === 'accepted'
  }

  return { canInstall: Boolean(prompt), installed, install }
}
