import {
  BarCreditTransaction,
  BarLedgerEntry,
  BarLedgerEntryInput,
  BarLedgerEvent,
  BarLedgerItem,
  BarLedgerPayment,
  BarLedgerPaymentInput,
  BarPrepaymentInput,
  BarProduct,
  BarProductInput,
  DemoState,
} from '@/types/domain';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const timestamp = () => new Date().toISOString();

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const formatBarEuros = (value: number) => `${roundMoney(value).toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const barPaymentMethodLabel = (value?: 'cash' | 'transfer') => value === 'transfer' ? 'Ülekandega' : value === 'cash' ? 'Sulas' : '';
export const normalizeBarDebtorName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('et-EE');

export interface BarProductSuggestion {
  key: string;
  productId?: string;
  name: string;
  unitPrice: number;
}

function suggestionMatches(name: string, query: string) {
  return normalizeBarDebtorName(name).includes(normalizeBarDebtorName(query));
}

function productSuggestionMatches(name: string, query: string) {
  const normalizedName = normalizeBarDebtorName(name);
  const normalizedQuery = normalizeBarDebtorName(query);
  return normalizedName.startsWith(normalizedQuery) || normalizedName.includes(` ${normalizedQuery}`);
}

function compareSuggestionNames(left: string, right: string, query: string) {
  const normalizedQuery = normalizeBarDebtorName(query);
  const leftStartsWithQuery = normalizeBarDebtorName(left).startsWith(normalizedQuery);
  const rightStartsWithQuery = normalizeBarDebtorName(right).startsWith(normalizedQuery);
  if (leftStartsWithQuery !== rightStartsWithQuery) return leftStartsWithQuery ? -1 : 1;
  return left.localeCompare(right, 'et');
}

export function barDebtorSuggestions(state: DemoState, ownerId: string, query: string, limit = 6) {
  if (!normalizeBarDebtorName(query)) return [];
  return state.barDebtors
    .filter((debtor) => debtor.owner_id === ownerId && suggestionMatches(debtor.name, query))
    .sort((left, right) => compareSuggestionNames(left.name, right.name, query) || right.updated_at.localeCompare(left.updated_at))
    .slice(0, limit);
}

export function barProductSuggestions(state: DemoState, ownerId: string, query: string, limit = 6): BarProductSuggestion[] {
  if (!normalizeBarDebtorName(query)) return [];
  const ownerEntryIds = new Set(state.barLedgerEntries.filter((entry) => entry.owner_id === ownerId).map((entry) => entry.id));
  const suggestions = new Map<string, BarProductSuggestion>();

  [...state.barLedgerItems]
    .filter((item) => ownerEntryIds.has(item.entry_id))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .forEach((item) => {
      const key = normalizeBarDebtorName(item.product_name);
      if (key && !suggestions.has(key)) suggestions.set(key, { key, name: item.product_name, unitPrice: Number(item.unit_price) });
    });

  state.barProducts.filter((product) => product.active).forEach((product) => {
    const key = normalizeBarDebtorName(product.name);
    suggestions.set(key, { key, productId: product.id, name: product.name, unitPrice: Number(product.unit_price) });
  });

  return [...suggestions.values()]
    .filter((suggestion) => productSuggestionMatches(suggestion.name, query))
    .sort((left, right) => compareSuggestionNames(left.name, right.name, query))
    .slice(0, limit);
}

export function isExactGroupAdmin(state: DemoState, userId: string) {
  return state.groupMembers.some((member) => member.profile_id === userId && member.role === 'admin');
}

export function barEntryVisibleTo(state: DemoState, entry: BarLedgerEntry, userId: string) {
  return entry.owner_id === userId || isExactGroupAdmin(state, userId);
}

export function barEntryItems(state: DemoState, entryId: string) {
  return state.barLedgerItems.filter((item) => item.entry_id === entryId);
}

export function activeBarPayments(state: DemoState, entryId: string) {
  return state.barLedgerPayments.filter((payment) => payment.entry_id === entryId && !payment.voided_at);
}

export function barEntryPaid(state: DemoState, entryId: string) {
  return roundMoney(activeBarPayments(state, entryId).reduce((sum, payment) => sum + Number(payment.amount), 0));
}

export function barEntryRemaining(state: DemoState, entry: BarLedgerEntry) {
  return entry.status === 'cancelled' ? 0 : roundMoney(Math.max(0, Number(entry.total_amount) - barEntryPaid(state, entry.id)));
}

export function barDebtorCreditBalance(state: DemoState, debtorId: string) {
  return roundMoney(state.barCreditTransactions
    .filter((transaction) => transaction.debtor_id === debtorId && !transaction.voided_at)
    .reduce((sum, transaction) => sum + (transaction.kind === 'deposit' ? Number(transaction.amount) : -Number(transaction.amount)), 0));
}

export function mergeDuplicateBarDebtorsInDemo(state: DemoState): DemoState {
  const canonicalByKey = new Map<string, string>();
  const replacements = new Map<string, string>();
  const debtors = state.barDebtors.filter((debtor) => {
    const key = `${debtor.group_id}:${debtor.owner_id}:${normalizeBarDebtorName(debtor.name)}`;
    const canonical = canonicalByKey.get(key);
    if (!canonical) { canonicalByKey.set(key, debtor.id); return true; }
    replacements.set(debtor.id, canonical);
    return false;
  });
  if (!replacements.size) return state;
  return {
    ...state,
    barDebtors: debtors,
    barLedgerEntries: state.barLedgerEntries.map((entry) => ({ ...entry, debtor_id: replacements.get(entry.debtor_id) ?? entry.debtor_id })),
    barCreditTransactions: state.barCreditTransactions.map((transaction) => ({ ...transaction, debtor_id: replacements.get(transaction.debtor_id) ?? transaction.debtor_id })),
  };
}

function canManage(state: DemoState, entry: BarLedgerEntry, userId: string) {
  if (!barEntryVisibleTo(state, entry, userId)) throw new Error('Sul ei ole lubatud seda vihikukirjet muuta.');
}

function validateEntryInput(input: BarLedgerEntryInput) {
  if (!input.debtor_name.trim()) throw new Error('Sisesta inimese nimi.');
  if (!input.items.length) throw new Error('Lisa vähemalt üks toode.');
  const items = input.items.map((item) => {
    const productName = item.product_name.trim();
    const quantity = Number(item.quantity);
    const unitPrice = roundMoney(Number(item.unit_price));
    if (!productName) throw new Error('Sisesta iga toote nimi.');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Kogus peab olema nullist suurem.');
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('Hind peab olema nullist suurem.');
    return { ...item, product_name: productName, quantity, unit_price: unitPrice, line_total: roundMoney(quantity * unitPrice) };
  });
  const total = roundMoney(items.reduce((sum, item) => sum + item.line_total, 0));
  if (total <= 0) throw new Error('Kriipsu summa peab olema nullist suurem.');
  return { items, total };
}

function event(entryId: string, actorId: string, eventType: BarLedgerEvent['event_type'], details: Record<string, unknown>, at: string): BarLedgerEvent {
  return { id: uid('bar-event'), entry_id: entryId, actor_id: actorId, event_type: eventType, details, created_at: at, updated_at: at };
}

function findDebtorByName(state: DemoState, groupId: string, ownerId: string, name: string) {
  const normalized = normalizeBarDebtorName(name);
  return state.barDebtors.find((debtor) => debtor.group_id === groupId && debtor.owner_id === ownerId && normalizeBarDebtorName(debtor.name) === normalized);
}

function applyAvailableCreditInDemo(state: DemoState, actorId: string, entryId: string): DemoState {
  const entry = state.barLedgerEntries.find((value) => value.id === entryId);
  if (!entry || entry.status !== 'open') return state;
  const amount = roundMoney(Math.min(barEntryRemaining(state, entry), barDebtorCreditBalance(state, entry.debtor_id)));
  if (amount <= 0) return state;
  const at = timestamp();
  const credit: BarCreditTransaction = {
    id: uid('bar-credit'), group_id: entry.group_id, owner_id: entry.owner_id, debtor_id: entry.debtor_id, entry_id: entry.id,
    kind: 'usage', amount, occurred_at: at, recorded_by: actorId, note: 'Rakendatud automaatselt ostule', created_at: at, updated_at: at,
  };
  const payment: BarLedgerPayment = {
    id: uid('bar-payment'), entry_id: entry.id, amount, paid_at: at, recorded_by: actorId, source: 'prepayment',
    credit_transaction_id: credit.id, note: 'Tasutud ettemaksest', created_at: at, updated_at: at,
  };
  const isPaid = amount === barEntryRemaining(state, entry);
  return {
    ...state,
    barCreditTransactions: [credit, ...state.barCreditTransactions],
    barLedgerPayments: [payment, ...state.barLedgerPayments],
    barLedgerEntries: state.barLedgerEntries.map((value) => value.id === entry.id ? { ...value, status: isPaid ? 'paid' : 'open', paid_at: isPaid ? at : undefined, updated_at: at } : value),
    barLedgerEvents: [event(entry.id, actorId, 'payment_added', { payment_id: payment.id, amount, source: 'prepayment' }, at), ...state.barLedgerEvents],
  };
}

export function createBarLedgerEntryInDemo(state: DemoState, userId: string, input: BarLedgerEntryInput): DemoState {
  const { items: validItems, total } = validateEntryInput(input);
  const at = timestamp();
  const groupId = state.groups[0]?.id ?? 'family';
  let debtor = input.debtor_id ? state.barDebtors.find((value) => value.id === input.debtor_id) : undefined;
  if (debtor && debtor.owner_id !== userId) throw new Error('Valitud inimene ei kuulu sinu vihikusse.');
  debtor ??= findDebtorByName(state, groupId, userId, input.debtor_name);
  if (!debtor) {
    debtor = { id: uid('bar-debtor'), group_id: groupId, owner_id: userId, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || undefined, created_at: at, updated_at: at };
  } else {
    debtor = { ...debtor, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || debtor.contact, updated_at: at };
  }
  const entry: BarLedgerEntry = { id: uid('bar-entry'), group_id: groupId, owner_id: userId, debtor_id: debtor.id, occurred_at: input.occurred_at, note: input.note?.trim() || undefined, payment_method: input.payment_method ?? 'cash', total_amount: total, status: 'open', created_at: at, updated_at: at };
  const ledgerItems: BarLedgerItem[] = validItems.map((item) => ({ id: uid('bar-item'), entry_id: entry.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total, created_at: at, updated_at: at }));
  const next = {
    ...state,
    barDebtors: [debtor, ...state.barDebtors.filter((value) => value.id !== debtor!.id)],
    barLedgerEntries: [entry, ...state.barLedgerEntries],
    barLedgerItems: [...ledgerItems, ...state.barLedgerItems],
    barLedgerEvents: [event(entry.id, userId, 'created', { total_amount: total }, at), ...state.barLedgerEvents],
  };
  return applyAvailableCreditInDemo(next, userId, entry.id);
}

export function updateBarLedgerEntryInDemo(state: DemoState, userId: string, entryId: string, input: BarLedgerEntryInput): DemoState {
  const target = state.barLedgerEntries.find((value) => value.id === entryId);
  if (!target) throw new Error('Vihikukirjet ei leitud.');
  canManage(state, target, userId);
  if (target.status === 'cancelled') throw new Error('Tühistatud kirjet ei saa muuta.');
  const { items: validItems, total } = validateEntryInput(input);
  const paid = barEntryPaid(state, entryId);
  if (total < paid) throw new Error(`Uus summa ei saa olla väiksem juba tasutud summast ${formatBarEuros(paid)}.`);
  const at = timestamp();
  let debtor = state.barDebtors.find((value) => value.id === input.debtor_id);
  if (debtor && debtor.owner_id !== target.owner_id) throw new Error('Valitud inimest ei leitud.');
  debtor ??= findDebtorByName(state, target.group_id, target.owner_id, input.debtor_name);
  if (!debtor) debtor = { id: uid('bar-debtor'), group_id: target.group_id, owner_id: target.owner_id, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || undefined, created_at: at, updated_at: at };
  const previous = { debtor_id: target.debtor_id, occurred_at: target.occurred_at, note: target.note, payment_method: target.payment_method, total_amount: target.total_amount, items: barEntryItems(state, entryId) };
  const nextStatus = paid === total ? 'paid' as const : 'open' as const;
  const nextItems: BarLedgerItem[] = validItems.map((item) => ({ id: uid('bar-item'), entry_id: entryId, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total, created_at: at, updated_at: at }));
  const next = {
    ...state,
    barDebtors: [{ ...debtor, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || debtor.contact, updated_at: at }, ...state.barDebtors.filter((value) => value.id !== debtor.id)],
    barLedgerEntries: state.barLedgerEntries.map((value) => value.id === entryId ? { ...value, debtor_id: debtor.id, occurred_at: input.occurred_at, note: input.note?.trim() || undefined, payment_method: input.payment_method ?? value.payment_method ?? 'cash', total_amount: total, status: nextStatus, paid_at: nextStatus === 'paid' ? value.paid_at ?? at : undefined, updated_at: at } : value),
    barLedgerItems: [...state.barLedgerItems.filter((value) => value.entry_id !== entryId), ...nextItems],
    barLedgerEvents: [event(entryId, userId, 'updated', { before: previous, total_amount: total }, at), ...state.barLedgerEvents],
  };
  return applyAvailableCreditInDemo(next, userId, entryId);
}

export function recordBarPaymentInDemo(state: DemoState, userId: string, entryId: string, input: BarLedgerPaymentInput): DemoState {
  const target = state.barLedgerEntries.find((value) => value.id === entryId);
  if (!target) throw new Error('Vihikukirjet ei leitud.');
  canManage(state, target, userId);
  if (target.status !== 'open') throw new Error('Sellele kirjetele ei saa makset lisada.');
  const amount = roundMoney(Number(input.amount));
  const remaining = barEntryRemaining(state, target);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Makse peab olema nullist suurem.');
  if (amount > remaining) throw new Error(`Makse ei saa olla suurem kui jääk ${formatBarEuros(remaining)}.`);
  const at = timestamp();
  const payment: BarLedgerPayment = { id: uid('bar-payment'), entry_id: entryId, amount, paid_at: input.paid_at, recorded_by: userId, source: 'payment', note: input.note?.trim() || undefined, created_at: at, updated_at: at };
  const isPaid = amount === remaining;
  return {
    ...state,
    barLedgerPayments: [payment, ...state.barLedgerPayments],
    barLedgerEntries: state.barLedgerEntries.map((value) => value.id === entryId ? { ...value, status: isPaid ? 'paid' : 'open', paid_at: isPaid ? input.paid_at : undefined, updated_at: at } : value),
    barLedgerEvents: [event(entryId, userId, 'payment_added', { payment_id: payment.id, amount }, at), ...state.barLedgerEvents],
  };
}

export function recordBarPrepaymentInDemo(state: DemoState, userId: string, input: BarPrepaymentInput): DemoState {
  const groupId = state.groups[0]?.id ?? 'family';
  const ownerId = input.owner_id ?? userId;
  if (ownerId !== userId && !isExactGroupAdmin(state, userId)) throw new Error('Sul ei ole lubatud selle inimese ettemakset muuta.');
  const amount = roundMoney(Number(input.amount));
  if (!input.debtor_name.trim()) throw new Error('Sisesta inimese nimi.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Ettemakse peab olema nullist suurem.');
  const at = timestamp();
  let debtor = input.debtor_id ? state.barDebtors.find((value) => value.id === input.debtor_id) : undefined;
  if (debtor && (debtor.group_id !== groupId || debtor.owner_id !== ownerId)) throw new Error('Valitud inimest ei leitud.');
  debtor ??= findDebtorByName(state, groupId, ownerId, input.debtor_name);
  if (!debtor) debtor = { id: uid('bar-debtor'), group_id: groupId, owner_id: ownerId, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || undefined, created_at: at, updated_at: at };
  else debtor = { ...debtor, name: input.debtor_name.trim(), contact: input.debtor_contact?.trim() || debtor.contact, updated_at: at };
  const deposit: BarCreditTransaction = {
    id: uid('bar-credit'), group_id: groupId, owner_id: ownerId, debtor_id: debtor.id, kind: 'deposit', amount,
    occurred_at: input.occurred_at, recorded_by: userId, note: input.note?.trim() || undefined, payment_method: input.payment_method ?? 'cash', created_at: at, updated_at: at,
  };
  let next: DemoState = {
    ...state,
    barDebtors: [debtor, ...state.barDebtors.filter((value) => value.id !== debtor!.id)],
    barCreditTransactions: [deposit, ...state.barCreditTransactions],
  };
  const openEntries = next.barLedgerEntries
    .filter((entry) => entry.debtor_id === debtor!.id && entry.status === 'open')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (const entry of openEntries) next = applyAvailableCreditInDemo(next, userId, entry.id);
  return next;
}

export function voidBarPrepaymentInDemo(state: DemoState, userId: string, transactionId: string): DemoState {
  const transaction = state.barCreditTransactions.find((value) => value.id === transactionId);
  if (!transaction || transaction.kind !== 'deposit') throw new Error('Ettemakset ei leitud.');
  if (transaction.owner_id !== userId && !isExactGroupAdmin(state, userId)) throw new Error('Sul ei ole lubatud seda ettemakset muuta.');
  if (transaction.voided_at) throw new Error('Ettemakse on juba tühistatud.');
  if (transaction.amount > barDebtorCreditBalance(state, transaction.debtor_id)) throw new Error('Ettemaksest on juba osa kasutatud. Tühista esmalt vastav ost või ettemakse kasutus.');
  const at = timestamp();
  return {
    ...state,
    barCreditTransactions: state.barCreditTransactions.map((value) => value.id === transactionId ? { ...value, voided_at: at, voided_by: userId, updated_at: at } : value),
  };
}

export function voidBarPaymentInDemo(state: DemoState, userId: string, paymentId: string): DemoState {
  const payment = state.barLedgerPayments.find((value) => value.id === paymentId);
  if (!payment) throw new Error('Makset ei leitud.');
  const entry = state.barLedgerEntries.find((value) => value.id === payment.entry_id);
  if (!entry) throw new Error('Vihikukirjet ei leitud.');
  canManage(state, entry, userId);
  if (payment.voided_at) throw new Error('Makse on juba tühistatud.');
  const at = timestamp();
  return {
    ...state,
    barLedgerPayments: state.barLedgerPayments.map((value) => value.id === paymentId ? { ...value, voided_at: at, voided_by: userId, updated_at: at } : value),
    barCreditTransactions: payment.credit_transaction_id ? state.barCreditTransactions.map((value) => value.id === payment.credit_transaction_id ? { ...value, voided_at: at, voided_by: userId, updated_at: at } : value) : state.barCreditTransactions,
    barLedgerEntries: state.barLedgerEntries.map((value) => value.id === entry.id && value.status !== 'cancelled' ? { ...value, status: 'open', paid_at: undefined, updated_at: at } : value),
    barLedgerEvents: [event(entry.id, userId, 'payment_voided', { payment_id: payment.id, amount: payment.amount }, at), ...state.barLedgerEvents],
  };
}

export function cancelBarLedgerEntryInDemo(state: DemoState, userId: string, entryId: string): DemoState {
  const target = state.barLedgerEntries.find((value) => value.id === entryId);
  if (!target) throw new Error('Vihikukirjet ei leitud.');
  canManage(state, target, userId);
  if (target.status === 'cancelled') throw new Error('Kirje on juba tühistatud.');
  const at = timestamp();
  const creditPaymentIds = new Set(state.barLedgerPayments.filter((payment) => payment.entry_id === entryId && payment.source === 'prepayment' && !payment.voided_at).map((payment) => payment.id));
  const creditTransactionIds = new Set(state.barLedgerPayments.filter((payment) => creditPaymentIds.has(payment.id) && payment.credit_transaction_id).map((payment) => payment.credit_transaction_id!));
  return {
    ...state,
    barLedgerEntries: state.barLedgerEntries.map((value) => value.id === entryId ? { ...value, status: 'cancelled', cancelled_at: at, cancelled_by: userId, updated_at: at } : value),
    barLedgerPayments: state.barLedgerPayments.map((payment) => creditPaymentIds.has(payment.id) ? { ...payment, voided_at: at, voided_by: userId, updated_at: at } : payment),
    barCreditTransactions: state.barCreditTransactions.map((transaction) => creditTransactionIds.has(transaction.id) ? { ...transaction, voided_at: at, voided_by: userId, updated_at: at } : transaction),
    barLedgerEvents: [event(entryId, userId, 'cancelled', { total_amount: target.total_amount }, at), ...state.barLedgerEvents],
  };
}

export function saveBarProductInDemo(state: DemoState, userId: string, input: BarProductInput): DemoState {
  const name = input.name.trim();
  const unitPrice = roundMoney(Number(input.unit_price));
  if (!name) throw new Error('Sisesta toote nimi.');
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('Hind peab olema nullist suurem.');
  const duplicate = state.barProducts.find((value) => value.id !== input.id && value.group_id === (state.groups[0]?.id ?? 'family') && value.name.toLocaleLowerCase('et-EE') === name.toLocaleLowerCase('et-EE'));
  if (duplicate) throw new Error('Sellise nimega toode on juba olemas.');
  const at = timestamp();
  if (input.id) {
    const target = state.barProducts.find((value) => value.id === input.id);
    if (!target) throw new Error('Toodet ei leitud.');
    if (target.created_by !== userId && !isExactGroupAdmin(state, userId)) throw new Error('Sul ei ole lubatud seda toodet muuta.');
    return { ...state, barProducts: state.barProducts.map((value) => value.id === input.id ? { ...value, name, unit_price: unitPrice, active: input.active ?? value.active, updated_at: at } : value) };
  }
  const product: BarProduct = { id: uid('bar-product'), group_id: state.groups[0]?.id ?? 'family', created_by: userId, name, unit_price: unitPrice, active: input.active ?? true, created_at: at, updated_at: at };
  return { ...state, barProducts: [product, ...state.barProducts] };
}
