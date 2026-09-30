export const defaultExpenses = [
  { id: 1, date: '2026-09-30', title: 'SuperBrugsen Arden', category: 'Dagligvarer', amount: 486.25 },
  { id: 2, date: '2026-09-29', title: 'Norlys', category: 'Bolig', amount: 1146 },
  { id: 3, date: '2026-09-28', title: 'REMA 1000 Arden', category: 'Dagligvarer', amount: 327.5 },
  { id: 4, date: '2026-09-27', title: 'Shell Arden', category: 'Transport', amount: 649 },
  { id: 5, date: '2026-09-26', title: 'Pizza & Grill Arden', category: 'Mad ude', amount: 268 },
  { id: 6, date: '2026-09-25', title: 'Netflix', category: 'Andet', amount: 119 },
]

export const budgets = [
  { label: 'Dagligvarer', used: 3240, limit: 5000, icon: 'basket' },
  { label: 'Bolig', used: 6950, limit: 8000, icon: 'home' },
  { label: 'Transport', used: 1860, limit: 3500, icon: 'car' },
  { label: 'Mad ude', used: 820, limit: 1500, icon: 'utensils' },
  { label: 'Andet', used: 2470, limit: 3800, icon: 'more' },
]

export const defaultOffers = [
  { id: 1, store: 'SuperBrugsen Arden', distance: '1,2 km', item: 'Kaffe', detail: 'Merrild 500 g', oldPrice: 54.95, price: 34.95, color: '#7f2f20', watched: true },
  { id: 2, store: 'SuperBrugsen Arden', distance: '1,2 km', item: 'Bleer', detail: 'Pampers str. 4', oldPrice: 129, price: 89, color: '#8dc9c5', watched: true },
  { id: 3, store: 'REMA 1000 Arden', distance: '1,5 km', item: 'Kyllingebryst', detail: 'Dansk, 600 g', oldPrice: 59.95, price: 39.95, color: '#e8c5a8', watched: false },
  { id: 4, store: 'REMA 1000 Arden', distance: '1,5 km', item: 'Havregryn', detail: '1 kg', oldPrice: 16.95, price: 11, color: '#d1b888', watched: true },
]

export const categories = ['Dagligvarer', 'Bolig', 'Transport', 'Mad ude', 'Andet']
