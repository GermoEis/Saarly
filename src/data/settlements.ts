import { DemoState, Notification, Settlement } from '@/types/domain';

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function formatEuros(amount: number) {
  return `${new Intl.NumberFormat('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} €`;
}

export function settlementVisibleTo(settlement: Settlement, userId: string) {
  return settlement.creditor_id === userId || settlement.debtor_id === userId;
}

function addNotification(state: DemoState, input: Omit<Notification, 'id' | 'created_at' | 'updated_at'>) {
  const at = now();
  return [{ ...input, id: uid('notification'), created_at: at, updated_at: at }, ...state.notifications];
}

export function createSettlementInDemo(
  state: DemoState,
  creditorId: string,
  input: Pick<Settlement, 'debtor_id' | 'amount' | 'description'> & Partial<Pick<Settlement, 'shopping_list_id'>>,
) {
  if (input.debtor_id === creditorId) throw new Error('Endale ei saa arveldust lisada.');
  if (!state.groupMembers.some((member) => member.profile_id === input.debtor_id)) throw new Error('Valitud kasutaja ei kuulu sellesse gruppi.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Sisesta nullist suurem summa.');
  const at = now();
  const settlement: Settlement = {
    id: uid('settlement'), group_id: state.groups[0]?.id ?? 'family', created_by: creditorId,
    creditor_id: creditorId, debtor_id: input.debtor_id, amount: input.amount,
    description: input.description.trim(), shopping_list_id: input.shopping_list_id,
    status: 'open', created_at: at, updated_at: at,
  };
  const creditor = state.profiles.find((profile) => profile.id === creditorId)?.display_name ?? 'Kasutaja';
  const notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'> = {
    group_id: settlement.group_id, user_id: input.debtor_id, actor_id: creditorId,
    list_id: input.shopping_list_id, type: 'settlement_created', title: 'Uus arveldus',
    body: settlement.description
      ? `${creditor} lisas sulle arvelduse ${formatEuros(input.amount)}: ${settlement.description}.`
      : `${creditor} lisas sulle arvelduse ${formatEuros(input.amount)}.`,
  };
  return { ...state, settlements: [settlement, ...state.settlements], notifications: addNotification(state, notification) };
}

export function markSettlementPaidInDemo(state: DemoState, settlementId: string, userId: string) {
  const target = state.settlements.find((value) => value.id === settlementId);
  if (!target || target.debtor_id !== userId || target.status !== 'open') throw new Error('Seda arveldust ei saa makstuks märkida.');
  const at = now();
  const debtor = state.profiles.find((profile) => profile.id === userId)?.display_name ?? 'Kasutaja';
  const notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'> = {
    group_id: target.group_id, user_id: target.creditor_id, actor_id: userId,
    list_id: target.shopping_list_id, type: 'settlement_marked_paid', title: 'Arveldus märgiti makstuks',
    body: `${debtor} märkis arvelduse ${formatEuros(target.amount)} makstuks. Palun kinnita raha laekumine.`,
  };
  return { ...state, settlements: state.settlements.map((value) => value.id === settlementId ? { ...value, status: 'marked_paid', marked_paid_at: at, updated_at: at } : value), notifications: addNotification(state, notification) } as DemoState;
}

export function confirmSettlementPaidInDemo(state: DemoState, settlementId: string, userId: string) {
  const target = state.settlements.find((value) => value.id === settlementId);
  if (!target || target.creditor_id !== userId || !['open', 'marked_paid'].includes(target.status)) throw new Error('Selle arvelduse tasumist ei saa kinnitada.');
  const at = now();
  const creditor = state.profiles.find((profile) => profile.id === userId)?.display_name ?? 'Kasutaja';
  const notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'> = {
    group_id: target.group_id, user_id: target.debtor_id, actor_id: userId,
    list_id: target.shopping_list_id, type: 'settlement_paid', title: 'Tasumine kinnitatud',
    body: target.status === 'open'
      ? `${creditor} märkis arvelduse ${formatEuros(target.amount)} tasutuks.`
      : `Arveldus ${formatEuros(target.amount)} on kinnitatud tasutuks.`,
  };
  return { ...state, settlements: state.settlements.map((value) => value.id === settlementId ? { ...value, status: 'paid', confirmed_at: at, updated_at: at } : value), notifications: addNotification(state, notification) } as DemoState;
}

export function cancelSettlementInDemo(state: DemoState, settlementId: string, userId: string) {
  const target = state.settlements.find((value) => value.id === settlementId);
  if (!target || target.creditor_id !== userId || !['open', 'marked_paid'].includes(target.status)) throw new Error('Seda arveldust ei saa tühistada.');
  const at = now();
  const notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'> = {
    group_id: target.group_id, user_id: target.debtor_id, actor_id: userId,
    list_id: target.shopping_list_id, type: 'settlement_cancelled', title: 'Arveldus tühistatud',
    body: `Arveldus ${formatEuros(target.amount)} tühistati.`,
  };
  return { ...state, settlements: state.settlements.map((value) => value.id === settlementId ? { ...value, status: 'cancelled', cancelled_at: at, updated_at: at } : value), notifications: addNotification(state, notification) } as DemoState;
}
