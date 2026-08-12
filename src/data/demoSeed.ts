import { DemoState } from '@/types/domain';

const now = '2026-08-07T09:00:00.000Z';
const ago = (hour: number) => `2026-08-07T${String(hour).padStart(2, '0')}:00:00.000Z`;
const base = (id: string, created_at = now) => ({ id, created_at, updated_at: created_at });

export function createDemoState(): DemoState {
  return {
    version: 3,
    currentUserId: null,
    profiles: [
      { ...base('user-a'), display_name: 'Kasutaja A', avatar_color: '#A8556A', theme_preference: 'light' },
      { ...base('user-b'), display_name: 'Kasutaja B', avatar_color: '#176B4D', theme_preference: 'light' },
      { ...base('user-c'), display_name: 'Kasutaja C', avatar_color: '#2563A7', theme_preference: 'light' },
      { ...base('user-d'), display_name: 'Kasutaja D', avatar_color: '#8B5E2F', theme_preference: 'light' },
    ],
    groups: [{ ...base('family'), name: 'Meie grupp', created_by: 'user-a', security_code: 'DEMO2026' }],
    groupMembers: [
      { ...base('gm-user-a'), group_id: 'family', profile_id: 'user-a', role: 'creator' },
      { ...base('gm-user-b'), group_id: 'family', profile_id: 'user-b', role: 'buyer' },
      { ...base('gm-user-c'), group_id: 'family', profile_id: 'user-c', role: 'admin' },
      { ...base('gm-user-d'), group_id: 'family', profile_id: 'user-d', role: 'buyer' },
    ],
    lists: [{ ...base('aug12'), group_id: 'family', created_by: 'user-a', name: 'Kaubad 12. augustiks', description: 'Palun tooge kaubad õhtusele laevale.' }],
    categories: [
      { ...base('food'), list_id: 'aug12', name: 'Toidukaubad', sort_order: 0 },
      { ...base('alcohol'), list_id: 'aug12', name: 'Alkohol', sort_order: 1 },
      { ...base('pharmacy'), list_id: 'aug12', name: 'Apteek', sort_order: 2 },
    ],
    categoryTemplates: [
      { ...base('tpl-food'), group_id: 'family', created_by: 'user-a', name: 'Toidukaubad', sort_order: 0 },
      { ...base('tpl-alcohol'), group_id: 'family', created_by: 'user-a', name: 'Alkohol', sort_order: 1 },
      { ...base('tpl-pharmacy'), group_id: 'family', created_by: 'user-a', name: 'Apteek', sort_order: 2 },
    ],
    items: [
      { ...base('bread', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'user-a', name: 'Sai', quantity: 2, unit: 'pätsi', note: 'Täistera, kui võimalik', assigned_to: 'user-b', status: 'accepted', searched_before: false },
      { ...base('eggs', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'user-a', name: 'Munad', quantity: 2, unit: 'karpi', assigned_to: 'user-c', status: 'accepted', searched_before: false },
      { ...base('milk', ago(8)), list_id: 'aug12', category_id: 'food', created_by: 'user-a', name: 'Piim', quantity: 3, unit: '× 1 l', status: 'unassigned', searched_before: true },
      { ...base('beer', ago(8)), list_id: 'aug12', category_id: 'alcohol', created_by: 'user-a', name: 'Õlu', quantity: 1, unit: '6-pakk', status: 'unassigned', searched_before: false },
      { ...base('cider', ago(8)), list_id: 'aug12', category_id: 'alcohol', created_by: 'user-a', name: 'Siider', quantity: 4, unit: 'purki', assigned_to: 'user-d', status: 'purchased', searched_before: false },
      { ...base('vitamins', ago(8)), list_id: 'aug12', category_id: 'pharmacy', created_by: 'user-a', name: 'D-vitamiin', quantity: 1, unit: 'purk', status: 'unassigned', searched_before: false },
    ],
    assignments: [
      { ...base('as-bread'), item_id: 'bread', user_id: 'user-b', assigned_by: 'user-a', status: 'accepted' },
      { ...base('as-eggs'), item_id: 'eggs', user_id: 'user-c', assigned_by: 'user-a', status: 'accepted' },
      { ...base('as-cider'), item_id: 'cider', user_id: 'user-d', assigned_by: 'user-a', status: 'accepted' },
    ],
    attempts: [{ ...base('try-milk', ago(11)), item_id: 'milk', user_id: 'user-b', outcome: 'not_found', note: 'Rimis oli otsas' }],
    deliveries: [{ ...base('delivery-1'), list_id: 'aug12', created_by: 'user-b', courier_id: 'user-b', ship_name: 'Baltic Queen', departure_date: '2026-08-12', departure_time: '18:00', port: 'Tallinn', handover_place: 'D-terminal', note: 'Helistan saabudes', status: 'planned' }],
    deliveryItems: [],
    notes: [{ ...base('note-port'), group_id: 'family', created_by: 'user-a', title: 'D-terminali info', content: 'Sadama infotelefon ja kogunemiskoht enne väljumist.', phone: '+372 631 8550', url: 'https://www.ts.ee/d-terminal/', pinned: true }],
    notifications: [
      { ...base('n1'), group_id: 'family', user_id: 'user-a', actor_id: 'user-b', list_id: 'aug12', type: 'delivery_updated', title: 'Laevainfo lisatud', body: 'Kasutaja B viib kaubad 12.08.2026 kell 18.00 laevale Baltic Queen. Kaubad antakse üle D-terminalis.' },
      { ...base('n2'), group_id: 'family', user_id: 'user-b', actor_id: 'user-a', list_id: 'aug12', item_id: 'bread', type: 'item_assigned', title: 'Uus ülesanne', body: 'Kasutaja A määras sulle toote „Sai“.' },
      { ...base('n3'), group_id: 'family', user_id: 'user-c', actor_id: 'user-a', list_id: 'aug12', item_id: 'eggs', type: 'item_assigned', title: 'Uus ülesanne', body: 'Kasutaja A määras sulle toote „Munad“.', read_at: now },
    ],
    activity: [
      { ...base('a1', ago(8)), group_id: 'family', actor_id: 'user-a', list_id: 'aug12', item_id: 'bread', action: 'Lisas toote', new_status: 'unassigned' },
      { ...base('a2', ago(9)), group_id: 'family', actor_id: 'user-a', list_id: 'aug12', item_id: 'bread', action: 'Määras toote kasutajale B', previous_status: 'unassigned', new_status: 'accepted' },
      { ...base('a3', ago(10)), group_id: 'family', actor_id: 'user-c', list_id: 'aug12', item_id: 'eggs', action: 'Võttis ülesande vastu', previous_status: 'assigned', new_status: 'accepted' },
      { ...base('a4', ago(12)), group_id: 'family', actor_id: 'user-d', list_id: 'aug12', item_id: 'cider', action: 'Märkis toote ostetuks', previous_status: 'accepted', new_status: 'purchased' },
      { ...base('a5', ago(11)), group_id: 'family', actor_id: 'user-b', list_id: 'aug12', item_id: 'milk', action: 'Ei leidnud toodet poest', previous_status: 'accepted', new_status: 'unassigned', explanation: 'Rimis oli otsas' },
    ],
    images: [{ ...base('img-milk'), item_id: 'milk', created_by: 'user-a', storage_path: 'demo/milk.png', preview_uri: 'demo' }],
    settlements: [
      { ...base('settlement-1'), group_id: 'family', created_by: 'user-c', creditor_id: 'user-c', debtor_id: 'user-b', amount: 24.5, description: 'Augusti poekaubad', shopping_list_id: 'aug12', status: 'open' },
      { ...base('settlement-2'), group_id: 'family', created_by: 'user-a', creditor_id: 'user-a', debtor_id: 'user-d', amount: 12, description: 'Apteegikaup', status: 'paid', marked_paid_at: now, confirmed_at: now },
    ],
  };
}
