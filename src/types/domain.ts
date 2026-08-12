export type ISODate = string;
export type ThemeMode = 'light' | 'dark';
export type Role = 'creator' | 'buyer' | 'admin';
export type SettlementStatus = 'open' | 'marked_paid' | 'paid' | 'cancelled';
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
  group_id: string; created_by: string; name: string; description?: string; archived_at?: ISODate; is_quick_list?: boolean;
}
export interface Category extends BaseEntity { list_id: string; name: string; sort_order: number; collapsed?: boolean }
export interface CategoryTemplate extends BaseEntity { group_id: string; created_by: string; name: string; sort_order: number }
export interface Item extends BaseEntity {
  list_id: string; category_id: string; created_by: string; name: string; quantity: number;
  unit?: string; note?: string; assigned_to?: string; status: ItemStatus; searched_before: boolean;
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
