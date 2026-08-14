import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/data/demoSeed';
import { categoriesForNewList, claimItem, declineItem, releaseAllItems, removeBuyerMember, saveDeliveryInDemo, setItemOutcome, setProfileThemePreference, statusForAssignment } from '../src/data/business';
import { canManageShoppingContent, deliveryCompletedNotification, deliveryNotification, visibleListsForUser } from '../src/data/access';
import { selectActiveGroupId } from '../src/data/groups';
import { GroupMembership } from '../src/types/domain';
import { cancelSettlementInDemo, confirmSettlementPaidInDemo, createSettlementInDemo, markSettlementPaidInDemo, settlementTotalsByParty, settlementVisibleTo } from '../src/data/settlements';

describe('Saarly põhivood', () => {
  it('kaks kasutajat ei saa sama ujuvat toodet endale võtta', () => {
    const first = claimItem(createDemoState(), 'beer', 'user-b');
    const second = claimItem(first.state, 'beer', 'user-c');
    expect(first.ok).toBe(true); expect(second.ok).toBe(false);
    expect(second.state.items.find((item) => item.id === 'beer')?.assigned_to).toBe('user-b');
    expect(second.message).toBe('Selle toote võttis juba teine viija.');
  });
  it('keeldumisel liigub toode tagasi ujuvasse nimekirja', () => {
    const state = declineItem(createDemoState(), 'bread', 'user-b'); const item = state.items.find((value) => value.id === 'bread');
    expect(item?.assigned_to).toBeUndefined(); expect(item?.status).toBe('unassigned');
    expect(state.activity.at(-1)?.action).toBe('Keeldus tootest');
  });
  it('Poes ei olnud säilitab varasema ajaloo ja lisab katse', () => {
    const claimed = claimItem(createDemoState(), 'beer', 'user-b').state; const before = claimed.activity.length;
    const after = setItemOutcome(claimed, 'beer', 'user-b', 'unavailable', 'Selveris otsas');
    expect(after.activity.length).toBe(before + 1); expect(after.attempts.at(-1)?.note).toBe('Selveris otsas');
    expect(after.items.find((item) => item.id === 'beer')?.searched_before).toBe(true);
  });
  it('ostetud toode jääb õige kasutajaga seotuks', () => {
    const before = createDemoState(); const notificationCount = before.notifications.length;
    const state = setItemOutcome(before, 'eggs', 'user-c', 'purchased'); const item = state.items.find((value) => value.id === 'eggs');
    expect(item?.status).toBe('purchased'); expect(item?.assigned_to).toBe('user-c');
    expect(state.notifications).toHaveLength(notificationCount);
  });
  it('teise grupi kasutaja ei näe nimekirja', () => {
    const state = createDemoState(); state.profiles.push({ id: 'stranger', display_name: 'Võõras', avatar_color: '#000', created_at: '', updated_at: '' });
    expect(visibleListsForUser(state, 'stranger')).toEqual([]); expect(visibleListsForUser(state, 'user-a')).toHaveLength(1);
  });
  it('kõigil grupiliikmetel on võrdsed ostunimekirja haldamise õigused', () => {
    const state = createDemoState();
    expect(['user-a', 'user-b', 'user-c', 'user-d'].every((userId) => canManageShoppingContent(state, userId))).toBe(true);
    expect(canManageShoppingContent(state, 'stranger')).toBe(false);
  });
  it('laevainfo loob nõutud eestikeelse teavituse', () => {
    expect(deliveryNotification('Kasutaja B', 'Baltic Queen', '2026-08-12', '18:00', 'D-terminal')).toBe('Kasutaja B viib kaubad 12.08.2026 kell 18:00 laevale Baltic Queen. Kaubad antakse üle D-terminalis.');
  });
  it('kõigist määratud asjadest loobumine viib need jooksvasse listi', () => {
    let state = createDemoState(); state = releaseAllItems(state, 'user-b');
    const bread = state.items.find((item) => item.id === 'bread');
    expect(bread?.assigned_to).toBeUndefined(); expect(bread?.status).toBe('unassigned');
    expect(state.activity.at(-1)?.action).toBe('Keeldus tootest');
  });
  it('laeva väljumise kellaaeg võib puududa', () => {
    expect(deliveryNotification('Kasutaja D', 'Victoria I', '2026-08-12', undefined, 'D-terminal')).toBe('Kasutaja D viib kaubad 12.08.2026 laevale Victoria I. Kaubad antakse üle D-terminalis.');
  });
  it('uus nimekiri saab varem salvestatud tühjad kategooriad', () => {
    const state = createDemoState(); let index = 0;
    const categories = categoriesForNewList(state.categoryTemplates, 'new-list', '2026-08-07T00:00:00Z', () => `new-${index++}`);
    expect(categories.map((category) => category.name)).toEqual(['Toidukaubad', 'Alkohol', 'Apteek']);
    expect(categories.every((category) => category.list_id === 'new-list')).toBe(true);
  });
  it('liige tekib alles liitumisel ja eemaldamisel vabanevad tema tooted', () => {
    const before = createDemoState();
    const after = removeBuyerMember(before, 'user-b', 'user-c');
    expect(after.groupMembers.some((member) => member.profile_id === 'user-b')).toBe(false);
    expect(after.profiles.some((profile) => profile.id === 'user-b')).toBe(true);
    expect(after.items.find((item) => item.id === 'bread')).toMatchObject({ status: 'unassigned', assigned_to: undefined });
    expect(after.activity.at(-1)).toMatchObject({ actor_id: 'user-c', action: 'Eemaldas kasutaja ja vabastas toote' });
  });
  it('viijale määratud toode on kohe vastu võetud', () => {
    expect(statusForAssignment('user-b')).toBe('accepted');
    expect(createDemoState().items.find((item) => item.id === 'bread')?.status).toBe('accepted');
  });
  it('kõigi ostetud kaupade laevale viimine muudab tooted ja teavitab koostajat laevainfoga', () => {
    const purchased = setItemOutcome(createDemoState(), 'bread', 'user-b', 'purchased');
    const completed = saveDeliveryInDemo(purchased, 'aug12', 'user-b', { ship_name: 'Baltic Queen', departure_date: '2026-08-12', departure_time: '18:00', port: 'Tallinn', handover_place: 'D-terminal' }, true);
    expect(completed.items.find((item) => item.id === 'bread')?.status).toBe('delivered');
    expect(completed.deliveries.find((delivery) => delivery.courier_id === 'user-b')?.status).toBe('delivered');
    expect(completed.notifications[0]).toMatchObject({ user_id: 'user-a', type: 'delivery_completed', body: 'Kasutaja B viis kaubad 12.08.2026 kell 18:00 laevale Baltic Queen. Kaubad anti üle D-terminalis.' });
  });
  it('laevale viimise teavitus töötab ka ilma väljumisajata', () => {
    expect(deliveryCompletedNotification('Kasutaja D', 'Victoria I', '2026-08-12', undefined, 'D-terminal')).toBe('Kasutaja D viis kaubad 12.08.2026 laevale Victoria I. Kaubad anti üle D-terminalis.');
  });
  it('laevainfo kavand ei teavita koostajat enne laevale viimist', () => {
    const state = createDemoState(); const before = state.notifications.length;
    const planned = saveDeliveryInDemo(state, 'aug12', 'user-b', { ship_name: 'Baltic Queen', departure_date: '2026-08-12', departure_time: '18:00', port: 'Tallinn', handover_place: 'D-terminal' }, false);
    expect(planned.notifications).toHaveLength(before);
  });
  it('hele või tume režiim salvestatakse eraldi iga kasutaja profiilile', () => {
    const changed = setProfileThemePreference(createDemoState(), 'user-b', 'dark');
    expect(changed.profiles.find((profile) => profile.id === 'user-b')?.theme_preference).toBe('dark');
    expect(changed.profiles.find((profile) => profile.id === 'user-c')?.theme_preference).toBe('light');
  });
  it('mitme grupi korral säilib kasutaja valitud aktiivne grupp', () => {
    const at = '2026-08-09T00:00:00.000Z';
    const groups: GroupMembership[] = [
      { id: 'group-a', name: 'Esimene', created_by: 'user', role: 'admin', created_at: at, updated_at: at },
      { id: 'group-b', name: 'Teine', created_by: 'other', role: 'buyer', created_at: at, updated_at: at },
    ];
    expect(selectActiveGroupId(groups, 'group-b')).toBe('group-b');
    expect(selectActiveGroupId(groups, 'removed-group')).toBe('group-a');
    expect(selectActiveGroupId([], 'group-b')).toBeNull();
  });
  it('arveldust näevad ainult raha saaja ja võlgnik', () => {
    const settlement = createDemoState().settlements[0];
    expect(settlementVisibleTo(settlement, 'user-c')).toBe(true);
    expect(settlementVisibleTo(settlement, 'user-b')).toBe(true);
    expect(settlementVisibleTo(settlement, 'user-a')).toBe(false);
  });
  it('mitu sama inimese arveldust liidetakse kokkuvõttes kokku', () => {
    const state = createSettlementInDemo(createDemoState(), 'user-c', { debtor_id: 'user-b', amount: 5.5, description: 'Teine ost' });
    expect(settlementTotalsByParty(state.settlements, 'user-b').iOwe).toEqual([{ profileId: 'user-c', amount: 30, count: 2 }]);
    expect(settlementTotalsByParty(state.settlements, 'user-c').owedToMe).toEqual([{ profileId: 'user-b', amount: 30, count: 2 }]);
  });
  it('arvelduse tasumine vajab võlgniku märget ja raha saaja kinnitust', () => {
    const created = createSettlementInDemo(createDemoState(), 'user-c', { debtor_id: 'user-d', amount: 18.75, description: 'Poekaubad' });
    const settlement = created.settlements[0];
    const marked = markSettlementPaidInDemo(created, settlement.id, 'user-d');
    expect(marked.settlements[0].status).toBe('marked_paid');
    const confirmed = confirmSettlementPaidInDemo(marked, settlement.id, 'user-c');
    expect(confirmed.settlements[0].status).toBe('paid');
    expect(confirmed.notifications.some((value) => value.user_id === 'user-d' && value.type === 'settlement_paid')).toBe(true);
  });
  it('arvelduse tühistamine jätab kirje ajalukku', () => {
    const state = createDemoState(); const before = state.settlements.length;
    const cancelled = cancelSettlementInDemo(state, 'settlement-1', 'user-c');
    expect(cancelled.settlements).toHaveLength(before);
    expect(cancelled.settlements.find((value) => value.id === 'settlement-1')?.status).toBe('cancelled');
  });
  it('arvelduse selgitus võib puududa', () => {
    const state = createSettlementInDemo(createDemoState(), 'user-c', { debtor_id: 'user-d', amount: 7.5, description: '' });
    expect(state.settlements[0].description).toBe('');
    expect(state.notifications[0].body).toBe('Kasutaja C lisas sulle arvelduse 7,50 €.');
  });
  it('raha saaja saab avatud arvelduse ise tasutuks märkida', () => {
    const state = confirmSettlementPaidInDemo(createDemoState(), 'settlement-1', 'user-c');
    expect(state.settlements.find((value) => value.id === 'settlement-1')?.status).toBe('paid');
    expect(state.notifications[0]).toMatchObject({ user_id: 'user-b', type: 'settlement_paid', body: 'Kasutaja C märkis arvelduse 24,50 € tasutuks.' });
  });
});
