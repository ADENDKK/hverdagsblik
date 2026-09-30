import { useCallback, useMemo, useState } from 'react'
import {
  Bell, Car, Check, ChevronDown, ChevronRight, Cloud, CloudOff, Copy, Download, Heart,
  Home, ListFilter, MapPin, Menu, MoreHorizontal, Plus, ReceiptText, Search,
  Settings, ShoppingBasket, Smartphone, Sparkles, Store, Tag, Trash2, Users, Utensils,
  WalletCards, X,
} from 'lucide-react'
import { budgets, categories, defaultExpenses, defaultOffers } from './data.js'
import { useHouseholdSync } from './useHouseholdSync.js'
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
const defaultStores = ['SuperBrugsen Arden', 'REMA 1000 Arden']
const defaultIncomes = [{ id: 'income-me', name: 'Mig', net: 0 }]

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

function OverviewHero({ incomes, expenses }) {
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
    <div className="budget-head"><h2>Budget pr. kategori</h2><button className="soft-button"><ListFilter size={16} /> Rediger budgetter</button></div>
    <div className="budget-list">
      {budgets.map((item) => {
        const Icon = iconMap[item.icon]
        const used = expenses.filter((expense) => expense.category === item.label).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
        const percentage = Math.min(100, Math.round((used / item.limit) * 100))
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

function OfferRail({ offers, setOffers, onSeeAll }) {
  const grouped = offers.reduce((acc, item) => ({ ...acc, [item.store]: [...(acc[item.store] || []), item] }), {})
  return <section className="rail-card offer-rail">
    <div className="rail-heading"><h2>Tilbud tæt på jer</h2><span><MapPin size={15} /> Arden</span><button onClick={onSeeAll}>Se alle tilbud <ChevronRight size={15} /></button></div>
    {Object.entries(grouped).map(([store, items]) => <div className="store-group" key={store}>
      <div className="store-heading"><span className="store-icon"><Store size={18} /></span><strong>{store}</strong><small>{items[0].distance}</small></div>
      {items.map((offer) => <div className="offer-row" key={offer.id}>
        <span className="product-swatch" style={{ '--swatch': offer.color }}><ShoppingBasket size={18} /></span>
        <div className="offer-copy"><strong>{offer.item}</strong><small>{offer.detail}</small></div>
        <div className="price"><s>{currency.format(offer.oldPrice)}</s><strong>{currency.format(offer.price)}</strong><small>Spar {currency.format(offer.oldPrice - offer.price)}</small></div>
        <label className="switch"><input type="checkbox" checked={offer.watched} onChange={() => setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, watched: !item.watched } : item))} /><span /></label>
      </div>)}
    </div>)}
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

function OffersPage({ offers, setOffers }) {
  const [filter, setFilter] = useState('all')
  const visible = filter === 'watched' ? offers.filter((offer) => offer.watched) : offers
  return <div className="page-stack"><div className="page-title"><div><h1>Tilbud tæt på jer</h1><p>Som standard vises alle tilgængelige tilbud.</p></div><div className="offer-filters" role="group" aria-label="Filtrer tilbud"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle tilbud</button><button className={filter === 'watched' ? 'active' : ''} onClick={() => setFilter('watched')}>Kun ønskeliste</button></div></div><OfferRail offers={visible} setOffers={setOffers} /></div>
}

function WishlistPage({ offers, setOffers }) {
  const [name, setName] = useState('')
  const watched = offers.filter((item) => item.watched)
  const add = (e) => { e.preventDefault(); if (!name.trim()) return; setOffers((items) => [...items, { id: Date.now(), store: 'Afventer butik', distance: 'Arden', item: name.trim(), detail: 'Vi holder øje', oldPrice: 0, price: 0, color: '#d6dfd8', watched: true }]); setName('') }
  return <div className="page-stack"><div className="page-title"><div><h1>Jeres ønskeliste</h1><p>Tilføj det, I mangler — så bliver gode tilbud lettere at finde.</p></div></div><form className="wishlist-form" onSubmit={add}><Heart size={20} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx vaskemiddel, kaffe eller bleer" /><button className="primary-button">Tilføj vare</button></form><div className="wishlist-list">{watched.map((item) => <div className="wishlist-item" key={item.id}><span className="product-swatch" style={{ '--swatch': item.color }}><ShoppingBasket size={18} /></span><div className="wishlist-item-copy"><strong>{item.item}</strong><small>{item.store} · {item.detail}</small></div><button className="row-action wishlist-remove" aria-label={`Fjern ${item.item} fra ønskelisten`} onClick={() => setOffers((current) => current.map((offer) => offer.id === item.id ? { ...offer, watched: false } : offer))}><X size={17} /></button></div>)}</div></div>
}

function IncomePage({ incomes, setIncomes }) {
  const update = (id, field, value) => setIncomes((items) => items.map((item) => item.id === id ? { ...item, [field]: field === 'net' ? Number(value) : value } : item))
  const add = () => setIncomes((items) => [...items, { id: `income-${Date.now()}`, name: `Person ${items.length + 1}`, net: 0 }])
  return <div className="page-stack"><div className="page-title"><div><h1>Indtægter</h1><p>Skriv det beløb, hver person får udbetalt efter skat.</p></div><button className="primary-button" onClick={add}><Plus size={18} /> Tilføj person</button></div><section className="income-list">{incomes.map((income, index) => <div className="income-row" key={income.id}><span className="income-person-icon"><Users size={19} /></span><label>Navn<input value={income.name} onChange={(event) => update(income.id, 'name', event.target.value)} aria-label={`Navn på person ${index + 1}`} /></label><label>Beløb efter skat<input type="number" min="0" step="1" value={income.net || ''} onChange={(event) => update(income.id, 'net', event.target.value)} placeholder="0" aria-label={`Beløb efter skat for ${income.name || `person ${index + 1}`}`} /></label><button className="row-action income-remove" disabled={incomes.length === 1} aria-label={`Fjern ${income.name || `person ${index + 1}`}`} onClick={() => setIncomes((items) => items.filter((item) => item.id !== income.id))}><X size={18} /></button></div>)}</section><div className="info-banner"><Sparkles /><div><strong>Du starter kun med “Mig”</strong><p>Hvis I senere vil have begge indtægter med, trykker I blot på “Tilføj person”. Beløbene deles automatisk mellem jeres telefoner.</p></div></div></div>
}

function StoresSetting({ stores, setStores }) {
  const [name, setName] = useState('')
  const add = (event) => { event.preventDefault(); const next = name.trim(); if (!next || stores.some((store) => store.toLowerCase() === next.toLowerCase())) return; setStores((items) => [...items, next]); setName('') }
  return <div className="setting-row stores-setting"><span className="setting-icon"><Store /></span><div className="settings-detail"><h2>Lokale butikker</h2><p>Tilføj eller fjern de butikker, I vil holde øje med.</p><div className="store-list">{stores.map((store) => <span className="store-chip" key={store}>{store}<button aria-label={`Fjern ${store}`} onClick={() => setStores((items) => items.filter((item) => item !== store))}><X size={14} /></button></span>)}</div><form className="store-edit-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Fx Netto Arden" aria-label="Ny butik" /><button className="outline-button">Tilføj butik</button></form></div><span className="privacy-label">{stores.length} butikker</span></div>
}

function SettingsPage({ sync, pwa, stores, setStores, onOpenIncomes }) {
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
    <StoresSetting stores={stores} setStores={setStores} />
    <div className="setting-row"><span className="setting-icon"><WalletCards /></span><div><h2>Indtægter efter skat</h2><p>Skriv din nettoløn direkte. Tilføj først en person mere, når I ønsker det.</p></div><button className="primary-button" onClick={onOpenIncomes}>Rediger beløb</button></div>
    <div className="setting-row"><span className="setting-icon"><WalletCards /></span><div><h2>Udgifter</h2><p>{sync.householdId ? 'Ændringer gemmes i jeres krypterede cloud-projekt og synkroniseres mellem enheder.' : 'Data gemmes lokalt, indtil fælles synkronisering er forbundet.'}</p></div><span className="privacy-label">Privat husstand</span></div>
  </section></div>
}

export default function App() {
  const [page, setPage] = useState('Overblik')
  const [query, setQuery] = useState('')
  const [expenses, setExpenses] = useStoredState('expenses-v1', defaultExpenses)
  const [offers, setOffers] = useStoredState('offers-v1', defaultOffers)
  const [incomes, setIncomes] = useStoredState('incomes-v1', defaultIncomes)
  const [stores, setStores] = useStoredState('stores-v1', defaultStores)
  const [modal, setModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const sharedData = useMemo(() => ({ expenses, offers, incomes, stores }), [expenses, offers, incomes, stores])
  const applyRemote = useCallback((remote) => {
    setExpenses(remote.expenses)
    setOffers(remote.offers)
    if (Array.isArray(remote.incomes) && remote.incomes.length) setIncomes(remote.incomes)
    if (Array.isArray(remote.stores)) setStores(remote.stores)
  }, [setExpenses, setOffers, setIncomes, setStores])
  const sync = useHouseholdSync(sharedData, applyRemote)
  const pwa = usePwaInstall()

  let content
  if (page === 'Overblik') content = <><div className="main-title"><div><h1>God aften — her er jeres september</h1><p>30. september 2026</p></div></div>{sync.status === 'unconfigured' || sync.status === 'solo' ? <button className="sync-notice" onClick={() => setPage('Indstillinger')}><Cloud size={19} /><span><strong>Gør Hverdagsblik fælles</strong><small>Forbind husstanden, så begge telefoner altid viser det samme.</small></span><ChevronRight size={18} /></button> : null}<div className="dashboard-grid"><main><OverviewHero incomes={incomes} expenses={expenses} /><ExpenseList expenses={expenses} setExpenses={setExpenses} query={query} openModal={() => setModal(true)} /></main><aside className="right-rail"><OfferRail offers={offers} setOffers={setOffers} onSeeAll={() => setPage('Tilbud')} /><IncomeCard incomes={incomes} onEdit={() => setPage('Indtægter')} /></aside></div></>
  else if (page === 'Udgifter') content = <div className="page-stack"><div className="page-title"><div><h1>Udgifter</h1><p>Alle poster samlet ét sted.</p></div></div><ExpenseList expenses={expenses} setExpenses={setExpenses} query={query} openModal={() => setModal(true)} full /></div>
  else if (page === 'Tilbud') content = <OffersPage offers={offers} setOffers={setOffers} />
  else if (page === 'Ønskeliste') content = <WishlistPage offers={offers} setOffers={setOffers} />
  else if (page === 'Indtægter') content = <IncomePage incomes={incomes} setIncomes={setIncomes} />
  else content = <SettingsPage sync={sync} pwa={pwa} stores={stores} setStores={setStores} onOpenIncomes={() => setPage('Indtægter')} />

  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} />{menuOpen ? <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Luk menu" /> : null}<div className="app-area"><Topbar onMenu={() => setMenuOpen(true)} query={query} setQuery={setQuery} sync={sync} onSyncClick={() => setPage('Indstillinger')} /><div className="page-content">{content}</div></div>{modal ? <AddExpenseModal onClose={() => setModal(false)} onAdd={(expense) => setExpenses((items) => [expense, ...items])} /> : null}</div>
}
