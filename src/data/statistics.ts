import { DemoState } from '@/types/domain';
import { normalizeProductName } from '@/data/duplicates';

export interface ProductStatistic { name: string; purchases: number }
export interface BuyerStatistic { userId: string; name: string; items: number }

export function groupStatistics(state: DemoState) {
  const validLists = new Set(state.lists.filter((list) => !list.deleted_at).map((list) => list.id));
  const completed = state.items.filter((item) => !item.deleted_at && validLists.has(item.list_id) && ['purchased', 'delivered'].includes(item.status));
  const products = new Map<string, ProductStatistic>();
  const buyers = new Map<string, BuyerStatistic>();

  completed.forEach((item) => {
    const key = normalizeProductName(item.name);
    const product = products.get(key);
    products.set(key, { name: product?.name ?? item.name.trim(), purchases: (product?.purchases ?? 0) + 1 });
    if (item.assigned_to) {
      const buyer = buyers.get(item.assigned_to);
      buyers.set(item.assigned_to, {
        userId: item.assigned_to,
        name: buyer?.name ?? state.profiles.find((profile) => profile.id === item.assigned_to)?.display_name ?? 'Kasutaja',
        items: (buyer?.items ?? 0) + 1,
      });
    }
  });

  const unpaid = state.settlements.filter((settlement) => settlement.status === 'open' || settlement.status === 'marked_paid');
  return {
    completedItems: completed.length,
    frequentProducts: [...products.values()].sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name, 'et')).slice(0, 10),
    activeBuyers: [...buyers.values()].sort((a, b) => b.items - a.items || a.name.localeCompare(b.name, 'et')).slice(0, 10),
    unpaidSettlements: unpaid.length,
    unpaidAmount: unpaid.reduce((sum, settlement) => sum + settlement.amount, 0),
  };
}
