import { DemoState } from '@/types/domain';
export function canManageShoppingContent(state: DemoState, userId: string | null) {
  return Boolean(userId && state.groupMembers.some((member) => member.profile_id === userId));
}
export function visibleListsForUser(state: DemoState, userId: string) {
  const groupIds = new Set(state.groupMembers.filter((member) => member.profile_id === userId).map((member) => member.group_id));
  return state.lists.filter((list) => groupIds.has(list.group_id));
}
export function deliveryNotification(actor: string, ship: string, date: string, time: string | undefined, place: string) {
  return `${actor} viib kaubad ${date.split('-').reverse().join('.')}${time ? ` kell ${time}` : ''} laevale ${ship}. Kaubad antakse üle ${place}${place.toLowerCase().includes('terminal') ? 'is' : 's'}.`;
}
export function deliveryCompletedNotification(actor: string, ship: string, date: string, time: string | undefined, place: string) {
  return `${actor} viis kaubad ${date.split('-').reverse().join('.')}${time ? ` kell ${time}` : ''} laevale ${ship}. Kaubad anti üle ${place}${place.toLowerCase().includes('terminal') ? 'is' : 's'}.`;
}
