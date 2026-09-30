import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const configured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('DIT-PROJEKT'))
const supabase = configured ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export function useHouseholdSync(data, applyRemote) {
  const [sync, setSync] = useState({ status: configured ? 'connecting' : 'unconfigured', householdId: null, inviteCode: null, error: null, updatedAt: null })
  const dataRef = useRef(data)
  const channelRef = useRef(null)
  const lastPayloadRef = useRef('')
  const readyRef = useRef(false)
  dataRef.current = data

  const updateFromRemote = useCallback((remoteData, updatedAt) => {
    if (!remoteData?.expenses || !remoteData?.offers) return
    const serialized = JSON.stringify(remoteData)
    if (serialized === lastPayloadRef.current) return
    lastPayloadRef.current = serialized
    applyRemote(remoteData)
    setSync((current) => ({ ...current, status: 'synced', updatedAt: updatedAt || new Date().toISOString(), error: null }))
  }, [applyRemote])

  const subscribe = useCallback((householdId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`household-${householdId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'household_state', filter: `household_id=eq.${householdId}`,
    }, (payload) => updateFromRemote(payload.new?.data, payload.new?.updated_at)).subscribe()
  }, [updateFromRemote])

  const connect = useCallback(async (householdId, inviteCode) => {
    const { data: row, error } = await supabase.from('household_state').select('data, updated_at').eq('household_id', householdId).single()
    if (error) throw error
    localStorage.setItem('hverdagsblik:household-id', householdId)
    if (inviteCode) localStorage.setItem('hverdagsblik:invite-code', inviteCode)
    const code = inviteCode || localStorage.getItem('hverdagsblik:invite-code')
    readyRef.current = true
    setSync({ status: 'synced', householdId, inviteCode: code, error: null, updatedAt: row.updated_at })
    if (row.data && Object.keys(row.data).length) updateFromRemote(row.data, row.updated_at)
    else {
      const payload = dataRef.current
      lastPayloadRef.current = JSON.stringify(payload)
      const { error: uploadError } = await supabase.from('household_state').update({ data: payload }).eq('household_id', householdId)
      if (uploadError) throw uploadError
    }
    subscribe(householdId)
  }, [subscribe, updateFromRemote])

  useEffect(() => {
    if (!configured) return undefined
    let active = true
    const start = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          const { error } = await supabase.auth.signInAnonymously()
          if (error) throw error
        }
        if (!active) return
        const householdId = localStorage.getItem('hverdagsblik:household-id')
        if (householdId) await connect(householdId)
        else setSync({ status: 'solo', householdId: null, inviteCode: null, error: null, updatedAt: null })
      } catch (error) {
        if (active) setSync({ status: 'error', householdId: null, inviteCode: null, error: error.message, updatedAt: null })
      }
    }
    start()
    return () => { active = false; if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [connect])

  useEffect(() => {
    if (!configured || !readyRef.current || !sync.householdId) return undefined
    const serialized = JSON.stringify(data)
    if (serialized === lastPayloadRef.current) return undefined
    const timer = window.setTimeout(async () => {
      setSync((current) => ({ ...current, status: 'syncing' }))
      const { error } = await supabase.from('household_state').upsert({ household_id: sync.householdId, data, updated_by: (await supabase.auth.getUser()).data.user?.id }, { onConflict: 'household_id' })
      if (error) setSync((current) => ({ ...current, status: 'error', error: error.message }))
      else { lastPayloadRef.current = serialized; setSync((current) => ({ ...current, status: 'synced', updatedAt: new Date().toISOString(), error: null })) }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data, sync.householdId])

  const createHousehold = async () => {
    setSync((current) => ({ ...current, status: 'connecting', error: null }))
    const { data: rows, error } = await supabase.rpc('create_household', { p_name: 'Vores hjem' })
    if (error) { setSync((current) => ({ ...current, status: 'error', error: error.message })); return null }
    const row = rows?.[0]
    await connect(row.household_id, row.invite_code)
    return row.invite_code
  }

  const joinHousehold = async (inviteCode) => {
    setSync((current) => ({ ...current, status: 'connecting', error: null }))
    const { data: rows, error } = await supabase.rpc('join_household', { p_invite_code: inviteCode.trim().toUpperCase() })
    if (error) { setSync((current) => ({ ...current, status: 'error', error: error.message })); return false }
    const row = rows?.[0]
    await connect(row.household_id, row.invite_code)
    return true
  }

  const uploadPayslipFile = async (file) => {
    if (!supabase || !sync.householdId) return null
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
    const path = `${sync.householdId}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('payslips').upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (error) { setSync((current) => ({ ...current, status: 'error', error: error.message })); return null }
    return path
  }

  const openPayslipFile = async (path) => {
    if (!supabase || !path) return false
    const { data: signed, error } = await supabase.storage.from('payslips').createSignedUrl(path, 60)
    if (error) { setSync((current) => ({ ...current, status: 'error', error: error.message })); return false }
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer')
    return true
  }

  return { ...sync, configured, createHousehold, joinHousehold, uploadPayslipFile, openPayslipFile }
}
