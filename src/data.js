export const defaultExpenses = []

export const budgets = [
  { label: 'Dagligvarer', used: 3240, limit: 5000, icon: 'basket' },
  { label: 'Bolig', used: 6950, limit: 8000, icon: 'home' },
  { label: 'Transport', used: 1860, limit: 3500, icon: 'car' },
  { label: 'Mad ude', used: 820, limit: 1500, icon: 'utensils' },
  { label: 'Andet', used: 2470, limit: 3800, icon: 'more' },
]

export const defaultOffers = []

export const localStores = [
  {
    name: 'SPAR Arden',
    address: 'Skovvej 2, 9510 Arden',
    latitude: 56.769225,
    longitude: 9.858268,
    flyerUrl: 'https://spar.dk/ugensavis',
  },
  {
    name: '365discount Arden',
    address: 'Vestergade 15, 9510 Arden',
    latitude: 56.769142,
    longitude: 9.856866,
    flyerUrl: 'https://365discount.coop.dk/365avisen-pdf/',
  },
]

export const categories = ['Dagligvarer', 'Bolig', 'Transport', 'Mad ude', 'Andet']
