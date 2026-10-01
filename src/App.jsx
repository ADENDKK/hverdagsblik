import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell, Car, Check, ChevronDown, ChevronRight, Cloud, CloudOff, Copy, Download, ExternalLink, FileUp, Heart,
  Home, ListFilter, LocateFixed, MapPin, Menu, MoreHorizontal, Plus, ReceiptText, RefreshCw, Search,
  Settings, ShoppingBasket, Smartphone, Sparkles, Store, Tag, Trash2, Users, Utensils,
  WalletCards, X,
} from 'lucide-react'
import { budgets as defaultBudgets, categories, defaultExpenses, defaultOffers, localStores } from './data.js'
import { parseBankCsv } from './bankImport.js'
import { useHouseholdSync } from './useHouseholdSync.js'
import { useOfficialOffers } from './useOfficialOffers.js'
import { usePwaInstall } from './usePwaInstall.js'

const currency = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`hverdagsblik:${key}`)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })
  const update = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      localStorage.setItem(`hverdagsblik:${key}`, JSON.stringify(resolved))
      return resolved
    })
  }, [key])
  return [value, update]
}

const iconMap = { basket: ShoppingBasket, home: Home, car: Car, utensils: Utensils, more: MoreHorizontal }
const navItems = [
  ['Overblik', Home], ['Udgifter', ReceiptText], ['Tilbud', Tag], ['Ønskeliste', Heart], ['Indtægter', WalletCards], ['Indstillinger', Settings],
]
const defaultStores = localStores.map((store) => store.name)
const defaultIncomes = [{ id: 'income-me', name: 'Mig', net: 0 }]
const legacyExpenseTitles = new Set(['SuperBrugsen Arden', 'Norlys', 'REMA 1000 Arden', 'Shell Arden', 'Pizza & Grill Arden', 'Netflix'])

const cleanLegacyExpenses = (items) => Array.isArray(items) ? items.filter((item) => !(Number(item.id) >= 1 && Number(item.id) <= 6 && legacyExpenseTitles.has(item.title))) : []
const normalizeStores = (items) => {
  const replacements = new Map([['SuperBrugsen Arden', 'SPAR Arden'], ['REMA 1000 Arden', '365discount Arden']])
  const normalized = (Array.isArray(items) ? items : defaultStores).map((item) => replacements.get(item) || item)
  return [...new Set(normalized.length ? normalized : defaultStores)]
}
const radians = (degrees) => degrees * (Math.PI / 180)
const distanceKm = (first, second) => {
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
const formatDistance = (value) => value < 1 ? `${Math.max(50, Math.round(value * 20) * 50)} m` : `${value.toLocaleString('da-DK', { maximumFractionDigits: 1 })} km`
const formatValidity = (from, to) => {
  if (!from || !to) return 'Gyldighed hentes automatisk'
  return `Gælder ${shortDate.format(new Date(`${from}T12:00:00`))} – ${shortDate.format(new Date(`${to}T12:00:00`))}`
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Home size={24} strokeWidth={2.2} /></span><span>Hverdagsblik</span></div>
}

function Sidebar({ page, setPage, open, close }) {
  return <aside className={`sidebar ${open ? 'is-open' : ''}`}>
    <div className="sidebar-top"><Brand /><button className="icon-button mobile-only" onClick={close} aria-label="Luk menu"><X /></button></div>
    <nav aria-label="Primær navigation">
      {navItems.map(([label, Icon]) => <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(label); close() }}><Icon size={21} /><span>{label}</span></button>)}
    </nav>
    <div className="local-note"><div className="village"><span /><span /><span /></div><div><MapPin size={16} /> Arden</div><p>Lokale tilbud. Større overblik.<br />En nemmere hverdag.</p></div>
  </aside>
}

function Topbar({ onMenu, query, setQuery, sync, onSyncClick }) {
  const online = sync.status === 'synced' || sync.status === 'syncing'
  return <header className="topbar">
    <button className="icon-button mobile-only" onClick={onMenu} aria-label="Åbn menu"><Menu /></button>
    <label className="search"><Search size={20} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søg i udgifter, butikker eller varer …" /></label>
    <div className="profile"><button className={`sync-chip ${online ? 'online' : ''}`} onClick={onSyncClick}>{online ? <Cloud size={16} /> : <CloudOff size={16} />}<span>{sync.status === 'syncing' ? 'Gemmer…' : online ? 'Synkroniseret' : 'Kun denne enhed'}</span></button><button className="icon-button notification" aria-label="Notifikationer"><Bell size={20} /><span /></button><span className="avatar">KH</span><span className="profile-name">Kasper & Helene</span><ChevronDown size={16} /></div>
  </header>
}

function OverviewHero({ incomes, expenses, budgetSettings, onEditBudgets }) {
  const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.net || 0), 0)
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const available = incomeTotal - expenseTotal
  const usedPercentage = incomeTotal > 0 ? Math.min(100, Math.round((expenseTotal / incomeTotal) * 100)) : 0
  return <section className="budget-shell">
    <div className="budget-totals">
      <div className={`available ${available < 0 ? 'negative' : ''}`}><span>Til rådighed</span><strong>{currency.format(available)}</strong></div>
      <div><span>Indtægter efter skat</span><strong>{currency.format(incomeTotal)}</strong></div>
      <div><span>Registrerede udgifter</span><strong>{currency.format(expenseTotal)}</strong></div>
    </div>
    <div className="big-progress"><i style={{ width: `${usedPercentage}%` }} /></div>
    <div className="progress-meta"><strong>{usedPercentage} % brugt</strong><span>{incomeTotal > 0 ? `${currency.format(available)} tilbage af ${currency.format(incomeTotal)}` : 'Tilføj din indtægt for at se rådighedsbeløbet'}</span></div>
    <div className="budget-head"><h2>Budget pr. kategori</h2><button className="soft-button" onClick={onEditBudgets}><ListFilter size={16} /> Rediger budgetter</button></div>
    <div className="budget-list">
      {budgetSettings.map((item) => {
        const Icon = iconMap[item.icon]
        const used = expenses.filter((expense) => expense.category === item.label).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
        const percentage = item.limit > 0 ? Math.min(100, Math.round((used / item.limit) * 100)) : used > 0 ? 100 : 0
        return <div className="budget-row" key={item.label}><Icon size={19} /><span className="category-name">{item.label}</span><span className="limit">{currency.format(item.limit)}</span><div className="mini-progress"><i className={percentage > 80 ? 'warm' : ''} style={{ width: `${percentage}%` }} /></div><strong>{currency.format(used)}</strong><ChevronRight size={16} /></div>
      })}
    </div>
  </section>
}

function ExpenseList({ expenses, setExpenses, query, openModal, full = false }) {
  const rows = useMemo(() => expenses.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [expenses, query])
  return <section className="expenses-section">
    <div className="section-heading"><div><h2>{full ? 'Alle udgifter' : 'Seneste udgifter'}</h2>{full ? <p>Hold styr på hver krone — gemt lokalt i din browser.</p> : null}</div><button className="primary-button" onClick={openModal}><Plus size={19} /> Tilføj udgift</button></div>
    <div className="expense-table">
      <div className="expense-row table-head"><span>Dato</span><span>Beskrivelse</span><span>Kategori</span><span>Beløb</span><span /></div>
      {rows.length ? rows.slice(0, full ? undefined : 6).map((item) => <div className="expense-row" key={item.id}>
        <span>{shortDate.format(new Date(`${item.date}T12:00:00`))}</span><strong>{item.title}</strong><span className="muted category-cell"><ShoppingBasket size={17} /> {item.category}</span><strong>{currency.format(item.amount)}</strong>
        <button className="row-action" title="Slet udgift" aria-label={`Slet ${item.title}`} onClick={() => setExpenses((current) => current.filter((expense) => expense.id !== item.id))}>{full ? <Trash2 size={16} /> : <ChevronRight size={16} />}</button>
      </div>) : <div className="empty-state">Ingen udgifter matcher din søgning.</div>}
    </div>
  </section>
}

function BankImportCard({ expenses, setExpenses }) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const parsed = parseBankCsv(await file.arrayBuffer())
      const existingIds = new Set(expenses.map((item) => String(item.id)))
      const newExpenses = parsed.expenses.filter((item) => !existingIds.has(String(item.id)))
      if (newExpenses.length) {
        setExpenses((items) => [...newExpenses, ...items].sort((first, second) => second.date.localeCompare(first.date)))
      }
      setResult({
        type: 'success',
        message: `${newExpenses.length} udgifter importeret. ${parsed.incomeRows} indbetalinger blev sprunget over${parsed.expenses.length - newExpenses.length ? `, og ${parsed.expenses.length - newExpenses.length} dubletter blev fundet` : ''}.`,
      })
    } catch (error) {
      setResult({ type: 'error', message: error.message })
    } finally {
      setBusy(false)
    }
  }

  return <section className="bank-import-card">
    <span className="setting-icon"><FileUp /></span>
    <div><h2>Importér fra Spar Nord</h2><p>Vælg CSV-filen fra netbanken. Kun hævninger bliver oprettet som udgifter, og dubletter ignoreres automatisk.</p>{result ? <span className={`import-result ${result.type}`}>{result.message}</span> : null}</div>
    <label className={`primary-button file-button ${busy ? 'disabled' : ''}`}><FileUp size={17} />{busy ? 'Læser fil…' : 'Vælg CSV-fil'}<input type="file" accept=".csv,text/csv" disabled={busy} onChange={importFile} /></label>
  </section>
}

function OfferRail({ offers, toggleOffer, onSeeAll, sources, compact = false, loading = false }) {
  const grouped = offers.reduce((acc, item) => ({ ...acc, [item.store]: [...(acc[item.store] || []), item] }), {})
  return <section className="rail-card offer-rail">
    <div className="rail-heading"><h2>Tilbud tæt på jer</h2><span><MapPin size={15} /> Arden</span>{onSeeAll ? <button onClick={onSeeAll}>Se alle tilbud <ChevronRight size={15} /></button> : null}</div>
    {loading ? <div className="offer-loading"><RefreshCw size={18} /> Henter de nyeste tilbud…</div> : null}
    {Object.entries(grouped).map(([store, items]) => <div className="store-group" key={store}>
      <div className="store-heading"><span className="store-icon"><Store size={18} /></span><div><strong>{store}</strong><small>{formatValidity(items[0].validFrom, items[0].validTo)}</small></div><span className="store-distance">{items[0].distance || 'Arden'}</span></div>
      <div className="flyer-link-row"><span>{items.length} aktuelle tilbud</span><a href={sources.find((source) => source.store === store)?.flyerUrl || items[0].flyerUrl} target="_blank" rel="noreferrer">Åbn tilbudsavis <ExternalLink size={14} /></a></div>
      {items.slice(0, compact ? 2 : undefined).map((offer) => <div className="offer-row" key={offer.id}>
        <span className="product-swatch" style={{ '--swatch': offer.color }}><ShoppingBasket size={18} /></span>
        <div className="offer-copy"><strong>{offer.item}</strong><small>{offer.detail}</small></div>
        <div className="price">{offer.oldPrice ? <span className="original-price">Førpris <s>{currency.format(offer.oldPrice)}</s></span> : <span className="original-price unavailable">Førpris ikke oplyst</span>}<strong>{currency.format(offer.price)}</strong>{offer.oldPrice ? <small>Spar {currency.format(offer.oldPrice - offer.price)}</small> : <small className="saving-unavailable">Besparelse ikke oplyst</small>}</div>
        <label className="switch" title="Føj til ønskelisten"><input type="checkbox" checked={offer.watched} onChange={() => toggleOffer(offer)} /><span /></label>
      </div>)}
      {compact && items.length > 2 ? <button className="more-offers" onClick={onSeeAll}>+ {items.length - 2} flere tilbud fra {store}</button> : null}
    </div>)}
    {!loading && !offers.length ? <div className="empty-state">Der er ingen tilbud at vise for de valgte butikker.</div> : null}
  </section>
}

function IncomeCard({ incomes, onEdit }) {
  const total = incomes.reduce((sum, item) => sum + Number(item.net || 0), 0)
  return <section className="rail-card income-card">
    <div className="rail-heading"><h2>Indtægt efter skat</h2><button onClick={onEdit}>Rediger <ChevronRight size={15} /></button></div>
    <div className="income-summary"><div className="document-icon"><WalletCards /></div><div><strong>{incomes.length === 1 ? '1 person' : `${incomes.length} personer`}</strong><small>Samlet pr. måned</small><b>{currency.format(total)}</b></div><span className="status-dot">✓ Delt</span></div>
    <p>{total > 0 ? 'Beløbet bruges automatisk til jeres rådighedsbeløb.' : 'Skriv det beløb, du får udbetalt efter skat.'}</p>
    <div className="income-actions"><button className="outline-button" onClick={onEdit}><WalletCards size={16} /> Rediger indtægter</button></div>
  </section>
}

function AddExpenseModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', amount: '', category: 'Dagligvarer', date: '2026-09-30' })
  const submit = (e) => { e.preventDefault(); if (!form.title || !form.amount) return; onAdd({ ...form, id: Date.now(), amount: Number(form.amount) }); onClose() }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
    <div className="modal-title"><div><h2 id="expense-title">Tilføj en udgift</h2><p>Beløbet gemmes i jeres Hverdagsblik.</p></div><button className="icon-button" onClick={onClose} aria-label="Luk"><X /></button></div>
    <form onSubmit={submit}><label>Beskrivelse<input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fx Apoteket Arden" /></label><div className="form-row"><label>Beløb<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></label><label>Dato<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label></div><label>Kategori<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button className="primary-button modal-submit" type="submit">Gem udgift</button></form>
  </div></div>
}

function BudgetModal({ budgets, onClose, onSave }) {
  const [draft, setDraft] = useState(() => budgets.map((item) => ({ ...item, limit: String(item.limit ?? '') })))
  const updateLimit = (label, limit) => setDraft((items) => items.map((item) => item.label === label ? { ...item, limit } : item))
  const submit = (event) => {
    event.preventDefault()
    onSave(draft.map((item) => ({ ...item, limit: Math.max(0, Number(item.limit) || 0) })))
    onClose()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-title">
    <div className="modal-title"><div><h2 id="budget-title">Rediger budgetter</h2><p>Sæt et månedligt beløb for hver kategori.</p></div><button className="icon-button" onClick={onClose} aria-label="Luk"><X /></button></div>
    <form onSubmit={submit}>
      <div className="budget-modal-list">{draft.map((item, index) => {
        const Icon = iconMap[item.icon]
        return <label className="budget-modal-row" key={item.label}><span className="setting-icon"><Icon size={18} /></span><span>{item.label}</span><span className="budget-input"><input autoFocus={index === 0} type="number" min="0" step="100" inputMode="numeric" value={item.limit} onChange={(event) => updateLimit(item.label, event.target.value)} aria-label={`Månedsbudget for ${item.label}`} /><small>kr.</small></span></label>
      })}</div>
      <div className="budget-modal-actions"><button className="outline-button" type="button" onClick={onClose}>Annuller</button><button className="primary-button" type="submit">Gem budgetter</button></div>
    </form>
  </div></div>
}

function OffersPage({ offers, toggleOffer, sources, offerFeed }) {
  const [filter, setFilter] = useState('all')
  const visible = filter === 'watched' ? offers.filter((offer) => offer.watched) : offers
  return <div className="page-stack"><div className="page-title"><div><h1>Tilbud tæt på jer</h1><p>Alle offentlige tilbud vises som standard. Gyldigheden kommer direkte fra kædernes tilbudsaviser.</p>{offerFeed.generatedAt ? <small className="feed-updated">Opdateret {shortDate.format(new Date(offerFeed.generatedAt))}</small> : null}{offerFeed.error ? <span className="error-note">{offerFeed.error}</span> : null}</div><div className="offer-filters" role="group" aria-label="Filtrer tilbud"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle tilbud</button><button className={filter === 'watched' ? 'active' : ''} onClick={() => setFilter('watched')}>Kun ønskeliste</button></div></div><OfferRail offers={visible} toggleOffer={toggleOffer} sources={sources} loading={offerFeed.loading} /></div>
}

function WishlistPage({ offers, setOffers, toggleOffer }) {
  const [name, setName] = useState('')
  const watched = offers.filter((item) => item.watched)
  const add = (e) => { e.preventDefault(); if (!name.trim()) return; setOffers((items) => [...items, { id: `wish-${Date.now()}`, source: 'wishlist', store: 'Ønskeliste', distance: 'Arden', item: name.trim(), detail: 'Vi holder øje', oldPrice: 0, price: 0, color: '#d6dfd8', watched: true }]); setName('') }
  return <div className="page-stack"><div className="page-title"><div><h1>Jeres ønskeliste</h1><p>Tilføj det, I mangler — så bliver gode tilbud lettere at finde.</p></div></div><form className="wishlist-form" onSubmit={add}><Heart size={20} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx vaskemiddel, kaffe eller bleer" /><button className="primary-button">Tilføj vare</button></form><div className="wishlist-list">{watched.map((item) => <div className="wishlist-item" key={item.id}><span className="product-swatch" style={{ '--swatch': item.color }}><ShoppingBasket size={18} /></span><div className="wishlist-item-copy"><strong>{item.item}</strong><small>{item.store} · {item.detail}</small></div><button className="row-action wishlist-remove" aria-label={`Fjern ${item.item} fra ønskelisten`} onClick={() => toggleOffer(item)}><X size={17} /></button></div>)}</div></div>
}

function IncomePage({ incomes, setIncomes }) {
  const update = (id, field, value) => setIncomes((items) => items.map((item) => item.id === id ? { ...item, [field]: field === 'net' ? Number(value) : value } : item))
  const add = () => setIncomes((items) => [...items, { id: `income-${Date.now()}`, name: `Person ${items.length + 1}`, net: 0 }])
  return <div className="page-stack"><div className="page-title"><div><h1>Indtægter</h1><p>Skriv det beløb, hver person får udbetalt efter skat.</p></div><button className="primary-button" onClick={add}><Plus size={18} /> Tilføj person</button></div><section className="income-list">{incomes.map((income, index) => <div className="income-row" key={income.id}><span className="income-person-icon"><Users size={19} /></span><label>Navn<input value={income.name} onChange={(event) => update(income.id, 'name', event.target.value)} aria-label={`Navn på person ${index + 1}`} /></label><label>Beløb efter skat<input type="number" min="0" step="1" value={income.net || ''} onChange={(event) => update(income.id, 'net', event.target.value)} placeholder="0" aria-label={`Beløb efter skat for ${income.name || `person ${index + 1}`}`} /></label><button className="row-action income-remove" disabled={incomes.length === 1} aria-label={`Fjern ${income.name || `person ${index + 1}`}`} onClick={() => setIncomes((items) => items.filter((item) => item.id !== income.id))}><X size={18} /></button></div>)}</section><div className="info-banner"><Sparkles /><div><strong>Du starter kun med “Mig”</strong><p>Hvis I senere vil have begge indtægter med, trykker I blot på “Tilføj person”. Beløbene deles automatisk mellem jeres telefoner.</p></div></div></div>
}

function StoresSetting({ stores, setStores, detectLocation, locationState }) {
  const [name, setName] = useState('')
  const add = (event) => { event.preventDefault(); const next = name.trim(); if (!next || stores.some((store) => store.toLowerCase() === next.toLowerCase())) return; setStores((items) => [...items, next]); setName('') }
  return <div className="setting-row stores-setting"><span className="setting-icon"><Store /></span><div className="settings-detail"><h2>Lokale butikker</h2><p>Hverdagsblik finder automatisk de understøttede butikker tæt på telefonens placering. Placeringen bliver kun gemt på denne enhed.</p><div className="store-list">{stores.map((store) => <span className="store-chip" key={store}>{store}<button aria-label={`Fjern ${store}`} onClick={() => setStores((items) => items.filter((item) => item !== store))}><X size={14} /></button></span>)}</div><div className="location-actions"><button className="outline-button" onClick={detectLocation} disabled={locationState.status === 'loading'}>{locationState.status === 'loading' ? <RefreshCw size={16} /> : <LocateFixed size={16} />}{locationState.status === 'loading' ? 'Finder placering…' : 'Find butikker nær mig'}</button>{locationState.message ? <span className={locationState.status === 'error' ? 'error-note' : 'location-note'}>{locationState.message}</span> : null}</div><form className="store-edit-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tilføj en anden butik manuelt" aria-label="Ny butik" /><button className="outline-button">Tilføj butik</button></form></div><span className="privacy-label">{stores.length} butikker</span></div>
}

function SettingsPage({ sync, pwa, stores, setStores, onOpenIncomes, detectLocation, locationState }) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const copyCode = async () => { await navigator.clipboard.writeText(sync.inviteCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return <div className="page-stack"><div className="page-title"><div><h1>Indstillinger</h1><p>Installer appen og forbind jeres fælles husstand.</p></div></div><section className="settings-panel">
    <div className="setting-row install-setting"><span className="setting-icon"><Smartphone /></span><div><h2>Genvej på telefonen</h2><p>{pwa.installed ? 'Hverdagsblik er installeret som app på denne enhed.' : ios ? 'På iPhone: tryk Del i Safari og vælg “Føj til hjemmeskærm”.' : pwa.canInstall ? 'Installer Hverdagsblik som en app direkte på hjemmeskærmen.' : 'Åbn browsermenuen og vælg “Installer app” eller “Føj til startskærm”.'}</p></div><button className="primary-button" disabled={pwa.installed || !pwa.canInstall} onClick={pwa.install}>{pwa.installed ? <Check size={17} /> : <Download size={17} />}{pwa.installed ? 'Installeret' : 'Installer app'}</button></div>
    <div className="setting-row sync-setting"><span className="setting-icon"><Cloud /></span><div className="settings-detail"><h2>Fælles synkronisering</h2>
      {sync.status === 'unconfigured' ? <><p>Funktionen er bygget, men cloud-databasen mangler at blive forbundet. Følg de tre trin i README-filen.</p><span className="setup-note">Supabase URL + anon key mangler</span></> : null}
      {sync.status === 'connecting' ? <p>Forbinder sikkert til jeres husstand…</p> : null}
      {sync.status === 'error' ? <><p>Forbindelsen kunne ikke oprettes.</p><span className="error-note">{sync.error}</span></> : null}
      {sync.status === 'solo' ? <><p>Opret husstanden på den første telefon, eller skriv invitationskoden fra den anden.</p><div className="sync-actions"><button className="primary-button" onClick={sync.createHousehold}>Opret vores husstand</button><form onSubmit={(event) => { event.preventDefault(); if (joinCode.trim()) sync.joinHousehold(joinCode) }}><input aria-label="Invitationskode" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={12} placeholder="12-tegns kode" /><button className="outline-button">Tilslut</button></form></div></> : null}
      {(sync.status === 'synced' || sync.status === 'syncing') ? <><p>Begge telefoner kan nu se de samme udgifter, tilbud og lønseddelstatus.</p><div className="invite-code"><span>Invitationskode</span><strong>{sync.inviteCode || 'Hentes…'}</strong><button className="icon-button" onClick={copyCode} aria-label="Kopiér invitationskode">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div></> : null}
    </div><span className={`sync-status ${sync.status}`}>{sync.status === 'synced' ? '● Online' : sync.status === 'syncing' ? '● Gemmer' : sync.status === 'unconfigured' ? 'Ikke forbundet' : sync.status === 'solo' ? 'Klar' : sync.status === 'error' ? 'Fejl' : 'Forbinder'}</span></div>
    <StoresSetting stores={stores} setStores={setStores} detectLocation={detectLocation} locationState={locationState} />
    <div className="setting-row"><span className="setting-icon"><WalletCards /></span><div><h2>Indtægter efter skat</h2><p>Skriv din nettoløn direkte. Tilføj først en person mere, når I ønsker det.</p></div><button className="primary-button" onClick={onOpenIncomes}>Rediger beløb</button></div>
    <div className="setting-row"><span className="setting-icon"><WalletCards /></span><div><h2>Udgifter</h2><p>{sync.householdId ? 'Ændringer gemmes i jeres krypterede cloud-projekt og synkroniseres mellem enheder.' : 'Data gemmes lokalt, indtil fælles synkronisering er forbundet.'}</p></div><span className="privacy-label">Privat husstand</span></div>
  </section></div>
}

export default function App() {
  const [page, setPage] = useState('Overblik')
  const [query, setQuery] = useState('')
  const [expenses, setExpenses] = useStoredState('expenses-v2', defaultExpenses)
  const [offers, setOffers] = useStoredState('offers-v2', defaultOffers)
  const [incomes, setIncomes] = useStoredState('incomes-v1', defaultIncomes)
  const [stores, setStores] = useStoredState('stores-v2', defaultStores)
  const [budgetSettings, setBudgetSettings] = useStoredState('budgets-v1', defaultBudgets)
  const [location, setLocation] = useStoredState('location-v1', null)
  const [locationState, setLocationState] = useState({ status: location ? 'ready' : 'idle', message: location ? 'Placeringen er gemt på denne enhed.' : '' })
  const [modal, setModal] = useState(false)
  const [budgetModal, setBudgetModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const offerFeed = useOfficialOffers()
  const sharedData = useMemo(() => ({ expenses, offers, incomes, stores, budgets: budgetSettings }), [expenses, offers, incomes, stores, budgetSettings])
  const applyRemote = useCallback((remote) => {
    setExpenses(cleanLegacyExpenses(remote.expenses))
    if (Array.isArray(remote.offers)) setOffers(remote.offers)
    if (Array.isArray(remote.incomes) && remote.incomes.length) setIncomes(remote.incomes)
    if (Array.isArray(remote.stores)) setStores(normalizeStores(remote.stores))
    if (Array.isArray(remote.budgets) && remote.budgets.length) setBudgetSettings(remote.budgets)
  }, [setExpenses, setOffers, setIncomes, setStores, setBudgetSettings])
  const sync = useHouseholdSync(sharedData, applyRemote)
  const pwa = usePwaInstall()

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({ status: 'error', message: 'Denne browser kan ikke dele placeringen.' })
      return
    }
    setLocationState({ status: 'loading', message: '' })
    navigator.geolocation.getCurrentPosition((position) => {
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      const nearby = localStores.filter((store) => distanceKm(nextLocation, store) <= 20).map((store) => store.name)
      setLocation(nextLocation)
      if (nearby.length) {
        setStores(nearby)
        setLocationState({ status: 'ready', message: `${nearby.join(' og ')} blev fundet automatisk.` })
      } else {
        setLocationState({ status: 'ready', message: 'Placeringen blev fundet, men ingen understøttede butikker ligger inden for 20 km.' })
      }
    }, (error) => {
      const denied = error.code === error.PERMISSION_DENIED
      setLocationState({ status: 'error', message: denied ? 'Placering blev ikke tilladt. Du kan stadig vælge butikkerne manuelt.' : 'Placeringen kunne ikke hentes lige nu.' })
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 3600000 })
  }, [setLocation, setStores])

  useEffect(() => {
    if (location || !navigator.permissions?.query) return
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (permission.state === 'granted') detectLocation()
    }).catch(() => {})
  }, [detectLocation, location])

  const preferenceMap = useMemo(() => new Map(offers.map((offer) => [String(offer.id), offer])), [offers])
  const selectedSources = useMemo(() => offerFeed.sources.filter((source) => stores.includes(source.store)), [offerFeed.sources, stores])
  const visibleOffers = useMemo(() => {
    const official = offerFeed.offers.filter((offer) => stores.includes(offer.store)).map((offer) => {
      const preference = preferenceMap.get(String(offer.id))
      const store = localStores.find((entry) => entry.name === offer.store)
      return {
        ...offer,
        watched: Boolean(preference?.watched),
        distance: location && store ? formatDistance(distanceKm(location, store)) : 'Arden',
      }
    })
    const custom = offers.filter((offer) => offer.source === 'wishlist')
    return [...official, ...custom]
  }, [offerFeed.offers, location, offers, preferenceMap, stores])

  const toggleOffer = useCallback((offer) => {
    setOffers((current) => {
      const exists = current.some((item) => String(item.id) === String(offer.id))
      if (exists) return current.map((item) => String(item.id) === String(offer.id) ? { ...item, watched: !offer.watched } : item)
      return [...current, { id: offer.id, watched: true, source: 'official-preference' }]
    })
  }, [setOffers])

  let content
  if (page === 'Overblik') content = <><div className="main-title"><div><h1>God aften — her er jeres september</h1><p>30. september 2026</p></div></div>{sync.status === 'unconfigured' || sync.status === 'solo' ? <button className="sync-notice" onClick={() => setPage('Indstillinger')}><Cloud size={19} /><span><strong>Gør Hverdagsblik fælles</strong><small>Forbind husstanden, så begge telefoner altid viser det samme.</small></span><ChevronRight size={18} /></button> : null}<div className="dashboard-grid"><main><OverviewHero incomes={incomes} expenses={expenses} budgetSettings={budgetSettings} onEditBudgets={() => setBudgetModal(true)} /><ExpenseList expenses={expenses} setExpenses={setExpenses} query={query} openModal={() => setModal(true)} /></main><aside className="right-rail"><OfferRail offers={visibleOffers} toggleOffer={toggleOffer} sources={selectedSources} compact loading={offerFeed.loading} onSeeAll={() => setPage('Tilbud')} /><IncomeCard incomes={incomes} onEdit={() => setPage('Indtægter')} /></aside></div></>
  else if (page === 'Udgifter') content = <div className="page-stack"><div className="page-title"><div><h1>Udgifter</h1><p>Alle poster samlet ét sted.</p></div></div><BankImportCard expenses={expenses} setExpenses={setExpenses} /><ExpenseList expenses={expenses} setExpenses={setExpenses} query={query} openModal={() => setModal(true)} full /></div>
  else if (page === 'Tilbud') content = <OffersPage offers={visibleOffers} toggleOffer={toggleOffer} sources={selectedSources} offerFeed={offerFeed} />
  else if (page === 'Ønskeliste') content = <WishlistPage offers={visibleOffers} setOffers={setOffers} toggleOffer={toggleOffer} />
  else if (page === 'Indtægter') content = <IncomePage incomes={incomes} setIncomes={setIncomes} />
  else content = <SettingsPage sync={sync} pwa={pwa} stores={stores} setStores={setStores} onOpenIncomes={() => setPage('Indtægter')} detectLocation={detectLocation} locationState={locationState} />

  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} />{menuOpen ? <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Luk menu" /> : null}<div className="app-area"><Topbar onMenu={() => setMenuOpen(true)} query={query} setQuery={setQuery} sync={sync} onSyncClick={() => setPage('Indstillinger')} /><div className="page-content">{content}</div></div>{modal ? <AddExpenseModal onClose={() => setModal(false)} onAdd={(expense) => setExpenses((items) => [expense, ...items])} /> : null}{budgetModal ? <BudgetModal budgets={budgetSettings} onClose={() => setBudgetModal(false)} onSave={setBudgetSettings} /> : null}</div>
}
