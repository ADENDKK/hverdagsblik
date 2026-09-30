import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(projectRoot, 'public', 'offers.json')
const monthNumbers = new Map([
  ['januar', 1], ['februar', 2], ['marts', 3], ['april', 4], ['maj', 5], ['juni', 6],
  ['juli', 7], ['august', 8], ['september', 9], ['oktober', 10], ['november', 11], ['december', 12],
])
const colors = ['#1f6b4f', '#d87043', '#8a4f7d', '#3d719b', '#b38b32', '#6f7b3c']

const getText = async (url, options) => {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`${url} svarede med ${response.status}`)
  return response.text()
}

const getJson = async (url, options) => JSON.parse(await getText(url, options))
const cleanText = (value = '') => value.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/\s+/g, ' ').trim()
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const copenhagenDate = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const datePart = (value) => {
  const parts = Object.fromEntries(copenhagenDate.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function parseDanishValidity(text) {
  const normalized = cleanText(text).replace(/<br\s*\/?>/gi, ' ')
  const match = normalized.match(/gælder fra(?:\s+\w+)?(?:\s+den)?\s+(\d{1,2})\.?\s+([a-zæøå]+)\s+til og med(?:\s+\w+)?(?:\s+den)?\s+(\d{1,2})\.?\s+([a-zæøå]+)\s+(\d{4})/i)
  if (!match) return { validFrom: null, validTo: null }
  const [, startDay, startMonthName, endDay, endMonthName, endYearText] = match
  const endYear = Number(endYearText)
  const startMonth = monthNumbers.get(startMonthName.toLowerCase())
  const endMonth = monthNumbers.get(endMonthName.toLowerCase())
  const startYear = startMonth > endMonth ? endYear - 1 : endYear
  return {
    validFrom: isoDate(startYear, startMonth, Number(startDay)),
    validTo: isoDate(endYear, endMonth, Number(endDay)),
  }
}

function quantityText(quantity) {
  if (!quantity?.size || !quantity?.unit?.symbol) return ''
  const { from, to } = quantity.size
  const size = from === to || to == null ? String(from) : `${from}-${to}`
  return `${size} ${quantity.unit.symbol}`
}

async function fetch365() {
  const flyerUrl = 'https://365discount.coop.dk/365avisen-pdf/'
  const html = await getText(flyerUrl)
  const publicationId = html.match(/data-publication-id=([^\s>]+)/i)?.[1]?.replace(/["']/g, '')
  const apiKey = html.match(/_shopgunApiKey='([^']+)'/)?.[1]
  if (!publicationId || !apiKey) throw new Error('365avisens publikationsoplysninger blev ikke fundet')
  const headers = { 'X-Api-Key': apiKey }
  const [catalog, hotspots] = await Promise.all([
    getJson(`https://api.etilbudsavis.dk/v2/catalogs/${publicationId}`, { headers }),
    getJson(`https://api.etilbudsavis.dk/v2/catalogs/${publicationId}/hotspots`, { headers }),
  ])

  const offers = hotspots
    .filter((entry) => entry.type === 'offer' && entry.offer?.pricing?.price != null)
    .map((entry, index) => ({
      id: `365-${entry.id}`,
      item: cleanText(entry.heading || entry.offer.heading),
      detail: quantityText(entry.offer.quantity),
      price: Number(entry.offer.pricing.price),
      oldPrice: entry.offer.pricing.pre_price == null ? null : Number(entry.offer.pricing.pre_price),
      color: colors[index % colors.length],
      source: '365avisen',
    }))

  return {
    store: '365discount Arden',
    address: 'Vestergade 15, 9510 Arden',
    latitude: 56.769142,
    longitude: 9.856866,
    flyerUrl,
    validFrom: datePart(catalog.run_from),
    validTo: datePart(catalog.run_till),
    offers,
  }
}

async function fetchSpar() {
  const storeUrl = 'https://arden.spar.dk/'
  const flyerUrl = 'https://spar.dk/ugensavis'
  const [storeHtml, flyerHtml] = await Promise.all([getText(storeUrl), getText('https://ugensavis.spar.dk/')])
  const cards = storeHtml.split(/<app-product-card\b/i).slice(1)
  const offers = cards.flatMap((card, index) => {
    const item = cleanText(card.match(/class="product-card-name"[^>]*>([^<]+)/i)?.[1])
    const detail = cleanText(card.match(/class="product-card-summary"[^>]*>([^<]*)/i)?.[1])
    const priceText = card.match(/class="product-card-price"[\s\S]*?<app-price[^>]*>[\s\S]*?([0-9]+(?:[,.][0-9]{1,2})?)/i)?.[1]
    if (!item || !priceText) return []
    return [{
      id: `spar-${item.toLowerCase().replace(/[^a-z0-9æøå]+/gi, '-').replace(/^-|-$/g, '')}`,
      item,
      detail,
      price: Number(priceText.replace(',', '.')),
      oldPrice: null,
      color: colors[(index + 2) % colors.length],
      source: 'SPAR Arden',
    }]
  })
  const validityText = flyerHtml.match(/AVISEN GÆLDER FRA[\s\S]{0,220}?\d{4}/i)?.[0] || ''

  return {
    store: 'SPAR Arden',
    address: 'Skovvej 2, 9510 Arden',
    latitude: 56.769225,
    longitude: 9.858268,
    flyerUrl,
    ...parseDanishValidity(validityText),
    offers,
  }
}

const results = await Promise.allSettled([fetchSpar(), fetch365()])
const sources = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
for (const result of results) {
  if (result.status === 'rejected') console.error(result.reason)
}
if (!sources.length) throw new Error('Ingen officielle tilbudskilder kunne opdateres')

let previous = null
try {
  previous = JSON.parse(await fs.readFile(outputPath, 'utf8'))
} catch {
  // Første opdatering har ingen tidligere fil at sammenligne med.
}
const sourcesChanged = JSON.stringify(previous?.sources || []) !== JSON.stringify(sources)
const payload = {
  generatedAt: sourcesChanged ? new Date().toISOString() : previous.generatedAt,
  sources,
}
await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`Gemte ${sources.reduce((sum, source) => sum + source.offers.length, 0)} tilbud fra ${sources.length} butikker i ${outputPath}`)
