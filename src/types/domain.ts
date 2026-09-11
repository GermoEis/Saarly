export type ISODate = string;
export type ThemeMode = 'light' | 'dark';
export type Role = 'creator' | 'buyer' | 'admin';
export type SettlementStatus = 'open' | 'marked_paid' | 'paid' | 'cancelled';
export type BarLedgerStatus = 'open' | 'paid' | 'cancelled';
export type BarPaymentMethod = 'cash' | 'transfer';
export type ItemStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'purchased'
  | 'unavailable'
  | 'delivered'
  | 'cancelled';

export interface BaseEntity { id: string; created_at: ISODate; updated_at: ISODate }
export interface Profile extends BaseEntity { display_name: string; avatar_color: string; theme_preference?: ThemeMode }
export interface Group extends BaseEntity { name: string; created_by: string; security_code?: string }
export interface GroupMember extends BaseEntity { group_id: string; profile_id: string; role: Role }
export interface GroupMembership extends Group { role: Role }
export interface GroupInvite extends BaseEntity {
  group_id: string;
  created_by: string;
  invitee_name?: string;
  expires_at: ISODate;
  used_at?: ISODate;
  revoked_at?: ISODate;
}
export interface ShoppingList extends BaseEntity {
  group_id: string; created_by: string; name: string; description?: string; archived_at?: ISODate; deleted_at?: ISODate; is_quick_list?: boolean;
}
export interface Category extends BaseEntity { list_id: string; name: string; sort_order: number; collapsed?: boolean }
export interface CategoryTemplate extends BaseEntity { group_id: string; created_by: string; name: string; sort_order: number }
export interface Item extends BaseEntity {
  list_id: string; category_id: string; created_by: string; name: string; quantity: number;
  unit?: string; note?: string; assigned_to?: string; status: ItemStatus; searched_before: boolean; deleted_at?: ISODate;
}
export interface ItemAssignment extends BaseEntity {
  item_id: string; user_id: string; assigned_by: string; status: 'pending' | 'accepted' | 'declined' | 'released';
}
export interface ItemAttempt extends BaseEntity { item_id: string; user_id: string; outcome: 'not_found'; note?: string }
export interface Delivery extends BaseEntity {
  list_id: string; created_by: string; courier_id: string; ship_name: string; departure_date: string;
  departure_time?: string; port: string; handover_place: string; note?: string; status: 'planned' | 'delivered';
}
export interface DeliveryItem extends BaseEntity { delivery_id: string; item_id: string }
export interface Note extends BaseEntity {
  group_id: string; created_by: string; title: string; content: string; phone?: string; url?: string;
  image_url?: string; pinned: boolean;
}
export interface Notification extends BaseEntity {
  group_id: string; user_id: string; actor_id?: string; list_id?: string; item_id?: string;
  type: string; title: string; body: string; read_at?: ISODate;
}
export interface ActivityLog extends BaseEntity {
  group_id: string; actor_id: string; list_id?: string; item_id?: string; action: string;
  previous_status?: ItemStatus; new_status?: ItemStatus; explanation?: string;
}
export interface ItemImage extends BaseEntity { item_id: string; created_by: string; storage_path: string; preview_uri?: string }
export interface PushToken extends BaseEntity { user_id: string; token: string; platform: 'ios' | 'android' | 'web' }
export interface Settlement extends BaseEntity {
  group_id: string;
  created_by: string;
  creditor_id: string;
  debtor_id: string;
  amount: number;
  description: string;
  shopping_list_id?: string;
  status: SettlementStatus;
  marked_paid_at?: ISODate;
  confirmed_at?: ISODate;
  cancelled_at?: ISODate;
}

export interface BarDebtor extends BaseEntity {
  group_id: string;
  owner_id: string;
  name: string;
  contact?: string;
}
export interface BarProduct extends BaseEntity {
  group_id: string;
  created_by: string;
  name: string;
  unit_price: number;
  active: boolean;
}
export interface BarLedgerEntry extends BaseEntity {
  group_id: string;
  owner_id: string;
  debtor_id: string;
  occurred_at: ISODate;
  note?: string;
  payment_method?: BarPaymentMethod;
  total_amount: number;
  status: BarLedgerStatus;
  paid_at?: ISODate;
  cancelled_at?: ISODate;
  cancelled_by?: string;
}
export interface BarLedgerItem extends BaseEntity {
  entry_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}
export interface BarLedgerPayment extends BaseEntity {
  entry_id: string;
  amount: number;
  paid_at: ISODate;
  recorded_by: string;
  source?: 'payment' | 'prepayment';
  credit_transaction_id?: string;
  note?: string;
  voided_at?: ISODate;
  voided_by?: string;
}
export interface BarCreditTransaction extends BaseEntity {
  group_id: string;
  owner_id: string;
  debtor_id: string;
  entry_id?: string;
  kind: 'deposit' | 'usage';
  amount: number;
  occurred_at: ISODate;
  recorded_by: string;
  note?: string;
  payment_method?: BarPaymentMethod;
  voided_at?: ISODate;
  voided_by?: string;
}
export interface BarLedgerEvent extends BaseEntity {
  entry_id: string;
  actor_id: string;
  event_type: 'created' | 'updated' | 'payment_added' | 'payment_voided' | 'cancelled';
  details: Record<string, unknown>;
}
export interface BarLedgerLineInput {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}
export interface BarLedgerEntryInput {
  debtor_id?: string;
  debtor_name: string;
  debtor_contact?: string;
  occurred_at: ISODate;
  note?: string;
  payment_method?: BarPaymentMethod;
  items: BarLedgerLineInput[];
}
export interface BarLedgerPaymentInput { amount: number; paid_at: ISODate; note?: string }
export interface BarPrepaymentInput {
  owner_id?: string;
  debtor_id?: string;
  debtor_name: string;
  debtor_contact?: string;
  amount: number;
  occurred_at: ISODate;
  note?: string;
  payment_method?: BarPaymentMethod;
}
export interface BarProductInput { id?: string; name: string; unit_price: number; active?: boolean }

export interface DemoState {
  version: number;
  currentUserId: string | null;
  profiles: Profile[];
  groups: Group[];
  groupMembers: GroupMember[];
  lists: ShoppingList[];
  categories: Category[];
  categoryTemplates: CategoryTemplate[];
  items: Item[];
  assignments: ItemAssignment[];
  attempts: ItemAttempt[];
  deliveries: Delivery[];
  deliveryItems: DeliveryItem[];
  notes: Note[];
  notifications: Notification[];
  activity: ActivityLog[];
  images: ItemImage[];
  settlements: Settlement[];
  barDebtors: BarDebtor[];
  barProducts: BarProduct[];
  barLedgerEntries: BarLedgerEntry[];
  barLedgerItems: BarLedgerItem[];
  barLedgerPayments: BarLedgerPayment[];
  barCreditTransactions: BarCreditTransaction[];
  barLedgerEvents: BarLedgerEvent[];
}

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; icon: string }> = {
  open: { label: 'Maksmata', icon: '○' },
  marked_paid: { label: 'Märgitud makstuks', icon: '✓' },
  paid: { label: 'Tasutud', icon: '✓' },
  cancelled: { label: 'Tühistatud', icon: '×' },
};

export const STATUS_META: Record<ItemStatus, { label: string; icon: string; color: string; background: string }> = {
  unassigned: { label: 'Määramata', icon: '○', color: '#4B5563', background: '#F1F3F4' },
  assigned: { label: 'Määratud', icon: '→', color: '#705300', background: '#FFF4C2' },
  accepted: { label: 'Vastu võetud', icon: '✓', color: '#185A71', background: '#DDF4FB' },
  purchased: { label: 'Ostetud', icon: '✓', color: '#176B4D', background: '#DDF3E8' },
  unavailable: { label: 'Poes ei olnud', icon: '!', color: '#9A3412', background: '#FDE8DF' },
  delivered: { label: 'Laevale viidud', icon: '⚓', color: '#3F3C87', background: '#E9E7FF' },
  cancelled: { label: 'Tühistatud', icon: '×', color: '#6B7280', background: '#ECEDEF' },
};
