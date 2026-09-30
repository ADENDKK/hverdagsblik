const categoryRules = [
  ['Dagligvarer', /spar|365|coop|netto|rema|lidl|meny|fakta|brugsen|føtex|bilka|supermarked|købmand/i],
  ['Transport', /circle k|shell|q8|ingo|uno-x|benzin|diesel|parkering|dsb|rejsekort/i],
  ['Bolig', /norlys|elhandel|energi|vand|varme|husleje|bolig|forsikring/i],
  ['Mad ude', /pizza|grill|restaurant|café|cafe|burger|mcdonald|just eat|wolt/i],
]

const normalizeHeader = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ø/g, 'o')
  .replace(/æ/g, 'ae')
  .trim()
  .toLowerCase()

const parseCsv = (text, delimiter = ';') => {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  row.push(field)
  if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

const decodeCsv = (arrayBuffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer)
  } catch {
    return new TextDecoder('windows-1252').decode(arrayBuffer)
  }
}

const parseAmount = (value) => {
  const compact = String(value || '').replace(/\s|\u00a0/g, '').replace(/[^\d,.-]/g, '')
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

const parseDate = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const hash = (value) => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

const categoryFor = (text) => categoryRules.find(([, matcher]) => matcher.test(text))?.[0] || 'Andet'
const titleFor = (parts) => {
  const raw = parts[0] || 'Bankpostering'
  const merchant = raw.match(/Forretning:\s*(.+?)\s+By\s+\.*:/i)?.[1]
  if (merchant) return merchant.trim()
  const mobilePay = raw.match(/MobilePay:\s*(.+?)(?:\s{2,}|$)/i)?.[1]
  if (mobilePay) return `MobilePay: ${mobilePay.trim()}`
  return raw
    .replace(/\s+(?:Kortnr|Kontonr|Terminal|Notanr|Wallet|Kurs)\.?\s*[:.].*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function parseBankCsv(arrayBuffer) {
  const text = decodeCsv(arrayBuffer)
  const delimiter = (text.split('\n', 1)[0].match(/;/g) || []).length >= (text.split('\n', 1)[0].match(/,/g) || []).length ? ';' : ','
  const rows = parseCsv(text, delimiter)
  if (rows.length < 2) throw new Error('Filen indeholder ingen posteringer.')

  const headers = rows[0].map(normalizeHeader)
  const indexOf = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)))
  const dateIndex = indexOf('dato', 'date')
  const amountIndex = indexOf('belob', 'amount')
  const textIndex = indexOf('tekst', 'text', 'beskrivelse')
  const recipientIndex = indexOf('tekst til modtager')
  const supplementaryIndex = indexOf('supp. tekst', 'supplerende')

  if (dateIndex < 0 || amountIndex < 0 || textIndex < 0) {
    throw new Error('CSV-filen skal mindst indeholde Dato, Beløb og Tekst.')
  }

  const occurrences = new Map()
  const expenses = []
  let incomeRows = 0
  let invalidRows = 0

  rows.slice(1).forEach((row) => {
    const date = parseDate(row[dateIndex])
    const amount = parseAmount(row[amountIndex])
    if (!date || amount === null || amount === 0) {
      invalidRows += 1
      return
    }
    if (amount > 0) {
      incomeRows += 1
      return
    }

    const textParts = [row[recipientIndex], row[supplementaryIndex], row[textIndex]]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    const title = titleFor(textParts)
    const signature = `${date}|${amount}|${row.join('|')}`
    const occurrence = (occurrences.get(signature) || 0) + 1
    occurrences.set(signature, occurrence)
    expenses.push({
      id: `bank-${hash(`${signature}|${occurrence}`)}`,
      date,
      title,
      category: categoryFor(textParts.join(' ')),
      amount: Math.abs(amount),
      source: 'Spar Nord CSV',
    })
  })

  return { expenses, incomeRows, invalidRows, totalRows: rows.length - 1 }
}
