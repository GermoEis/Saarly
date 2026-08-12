import { DemoState } from '@/types/domain';

const now = '2026-08-07T09:00:00.000Z';
const ago = (hour: number) => `2026-08-07T${String(hour).padStart(2, '0')}:00:00.000Z`;
const base = (id: string, created_at = now) => ({ id, created_at, updated_at: created_at });

export function createDemoState(): DemoState {
  return {
    version: 2,
    currentUserId: null,
    profiles: [
      { ...base('ema'), display_name: 'Ema', avatar_color: '#A8556A', theme_preference: 'light' },
      { ...base('helina'), display_name: 'Helina', avatar_color: '#176B4D', theme_preference: 'light' },
      { ...base('germo'), display_name: 'Germo', avatar_color: '#2563A7', theme_preference: 'light' },
      { ...base('mari'), display_name: 'Mari', avatar_color: '#8B5E2F', theme_preference: 'light' },
    ],
    groups: [{ ...base('family'), name: 'Meie grupp', created_by: 'ema', security_code: 'DEMO2026' }],
    groupMembers: [
      { ...base('gm-ema'), group_id: 'family', profile_id: 'ema', role: 'creator' },
      { ...base('gm-helina'), group_id: 'family', profile_id: 'helina', role: 'buyer' },
      { ...base('gm-germo'), group_id: 'family', profile_id: 'germo', role: 'admin' },
      { ...base('gm-mari'), group_id: 'family', profile_id: 'mari', role: 'buyer' },
    ],
    lists: [{ ...base('aug12'), group_id: 'family', created_by: 'ema', name: 'Kaubad 12. augustiks', description: 'Palun tooge kaubad õhtusele laevale.' }],
    categories: [
      { ...base('food'), list_id: 'aug12', name: 'Toidukaubad', sort_order: 0 },
      { ...base('alcohol'), list_id: 'aug12', name: 'Alkohol', sort_order: 1 },
      { ...base('pharmacy'), list_id: 'aug12', name: 'Apteek', sort_order: 2 },
    ],
    categoryTemplates: [
      { ...base('tpl-food'), group_id: 'family', created_by: 'ema', name: 'Toidukaubad', sort_order: 0 },
      { ...base('tpl-alcohol'), group_id: 'family', created_by: 'ema', name: 'Alkohol', sort_order: 1 },
      { ...base('tpl-pharmacy'), group_id: 'family', created_by: 'ema', name: 'Apteek', sort_order: 2 },
    ],
    items: [
      { ...base('bread', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'ema', name: 'Sai', quantity: 2, unit: 'pätsi', note: 'Täistera, kui võimalik', assigned_to: 'helina', status: 'accepted', searched_before: false },
      { ...base('eggs', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'ema', name: 'Munad', quantity: 2, unit: 'karpi', assigned_to: 'germo', status: 'accepted', searched_before: false },
      { ...base('milk', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'ema', name: 'Piim', quantity: 3, unit: '× 1 l', status: 'unassigned', searched_before: true },
      { ...base('beer', ago(8)), list_id: 'aug12', category_id: 'alcohol', created_by: 'ema', name: 'Õlu', quantity: 1, unit: '6-pakk', status: 'unassigned', searched_before: false },
      { ...base('cider', ago(8)), list_id: 'aug12', category_id: 'alcohol', created_by: 'ema', name: 'Siider', quantity: 4, unit: 'purki', assigned_to: 'mari', status: 'purchased', searched_before: false },
      { ...base('vitamins', ago(8)), list_id: 'aug12', category_id: 'pharmacy', created_by: 'ema', name: 'D-vitamiin', quantity: 1, unit: 'purk', status: 'unassigned', searched_before: false },
    ],
    assignments: [
      { ...base('as-bread'), item_id: 'bread', user_id: 'helina', assigned_by: 'ema', status: 'accepted' },
      { ...base('as-eggs'), item_id: 'eggs', user_id: 'germo', assigned_by: 'ema', status: 'accepted' },
      { ...base('as-cider'), item_id: 'cider', user_id: 'mari', assigned_by: 'ema', status: 'accepted' },
    ],
    attempts: [{ ...base('try-milk', ago(11)), item_id: 'milk', user_id: 'helina', outcome: 'not_found', note: 'Rimis oli otsas' }],
    deliveries: [{ ...base('delivery-1'), list_id: 'aug12', created_by: 'helina', courier_id: 'helina', ship_name: 'Baltic Queen', departure_date: '2026-08-12', departure_time: '18:00', port: 'Tallinn', handover_place: 'D-terminal', note: 'Helistan saabudes', status: 'planned' }],
    deliveryItems: [],
    notes: [{ ...base('note-port'), group_id: 'family', created_by: 'ema', title: 'D-terminali info', content: 'Sadama infotelefon ja kogunemiskoht enne väljumist.', phone: '+372 631 8550', url: 'https://www.ts.ee/d-terminal/', pinned: true }],
    notifications: [
      { ...base('n1'), group_id: 'family', user_id: 'ema', actor_id: 'helina', list_id: 'aug12', type: 'delivery_updated', title: 'Laevainfo lisatud', body: 'Helina viib kaubad 12.08.2026 kell 18.00 laevale Baltic Queen. Kaubad antakse üle D-terminalis.' },
      { ...base('n2'), group_id: 'family', user_id: 'helina', actor_id: 'ema', list_id: 'aug12', item_id: 'bread', type: 'item_assigned', title: 'Uus ülesanne', body: 'Ema määras sulle toote „Sai“.' },
      { ...base('n3'), group_id: 'family', user_id: 'germo', actor_id: 'ema', list_id: 'aug12', item_id: 'eggs', type: 'item_assigned', title: 'Uus ülesanne', body: 'Ema määras sulle toote „Munad“.', read_at: now },
    ],
    activity: [
      { ...base('a1', ago(8)), group_id: 'family', actor_id: 'ema', list_id: 'aug12', item_id: 'bread', action: 'Lisas toote', new_status: 'unassigned' },
      { ...base('a2', ago(9)), group_id: 'family', actor_id: 'ema', list_id: 'aug12', item_id: 'bread', action: 'Määras toote Helinale', previous_status: 'unassigned', new_status: 'accepted' },
      { ...base('a3', ago(10)), group_id: 'family', actor_id: 'germo', list_id: 'aug12', item_id: 'eggs', action: 'Võttis ülesande vastu', previous_status: 'assigned', new_status: 'accepted' },
      { ...base('a4', ago(12)), group_id: 'family', actor_id: 'mari', list_id: 'aug12', item_id: 'cider', action: 'Märkis toote ostetuks', previous_status: 'accepted', new_status: 'purchased' },
      { ...base('a5', ago(11)), group_id: 'family', actor_id: 'helina', list_id: 'aug12', item_id: 'milk', action: 'Ei leidnud toodet poest', previous_status: 'accepted', new_status: 'unassigned', explanation: 'Rimis oli otsas' },
    ],
    images: [{ ...base('img-milk'), item_id: 'milk', created_by: 'ema', storage_path: 'demo/milk.png', preview_uri: 'demo' }],
    settlements: [
      { ...base('settlement-1'), group_id: 'family', created_by: 'germo', creditor_id: 'germo', debtor_id: 'helina', amount: 24.5, description: 'Augusti poekaubad', shopping_list_id: 'aug12', status: 'open' },
      { ...base('settlement-2'), group_id: 'family', created_by: 'ema', creditor_id: 'ema', debtor_id: 'mari', amount: 12, description: 'Apteegikaup', status: 'paid', marked_paid_at: now, confirmed_at: now },
    ],
  };
}
