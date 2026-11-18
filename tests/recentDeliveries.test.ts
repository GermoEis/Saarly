import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/data/demoSeed';
import { recentDeliveriesForUser } from '../src/data/recentDeliveries';

const completedAt = '2026-10-04T10:00:00Z';
const expiry = Date.parse('2026-10-05T10:00:00Z');
const stateWithDelivery = () => {
  const state = createDemoState();
  const item = { ...state.items[0], assigned_to: 'user-b', status: 'delivered' as const, updated_at: completedAt };
  state.items = [item];
  state.activity = [{ id: 'completed', group_id: 'family', actor_id: 'user-b', item_id: item.id, action: 'Laevale viidud', previous_status: 'purchased', new_status: 'delivered', created_at: completedAt, updated_at: completedAt }];
  state.deliveryItems = [];
  return state;
};

describe('Hiljuti laevale viidud', () => {
  it('peidab toote täpselt 24 tunni möödumisel, säilitades andmed ja ajaloo', () => {
    const state = stateWithDelivery();
    expect(recentDeliveriesForUser(state, 'user-b', expiry - 1)).toHaveLength(1);
    expect(recentDeliveriesForUser(state, 'user-b', expiry)).toHaveLength(0);
    expect(recentDeliveriesForUser(state, 'user-b', expiry + 1)).toHaveLength(0);
    expect(state.items).toHaveLength(1);
    expect(state.activity).toHaveLength(1);
  });

  it('vana toote muutmine ei alusta 24 tunni arvestust uuesti', () => {
    const state = stateWithDelivery();
    state.items[0].updated_at = new Date(expiry + 1000).toISOString();
    state.activity.push({ ...state.activity[0], id: 'edit', previous_status: 'delivered', created_at: state.items[0].updated_at });
    expect(recentDeliveriesForUser(state, 'user-b', expiry + 2000)).toHaveLength(0);
  });

  it('äsja lõpetatud toode ilmub ka enne vaate järgmise kellavärskenduse saabumist', () => {
    const state = stateWithDelivery();
    expect(recentDeliveriesForUser(state, 'user-b', Date.parse(completedAt) - 1000)).toHaveLength(1);
  });

  it('arvestab viimast laevale viimist ka siis, kui varasem viimine võeti tagasi', () => {
    const state = stateWithDelivery();
    state.activity.unshift({ ...state.activity[0], id: 'completed-again', created_at: new Date(expiry).toISOString() });
    expect(recentDeliveriesForUser(state, 'user-b', expiry + 1000)).toHaveLength(1);
  });

  it('kasutab vana kirje puhul saadetise lõpetamise aega, mitte tulevast väljumisaega', () => {
    const state = stateWithDelivery();
    state.activity = [];
    state.items[0].updated_at = new Date(expiry).toISOString();
    state.deliveries = [{ ...state.deliveries[0], status: 'delivered', updated_at: completedAt, departure_date: '2026-10-10' }];
    state.deliveryItems = [{ id: 'link', delivery_id: state.deliveries[0].id, item_id: state.items[0].id, created_at: completedAt, updated_at: completedAt }];
    expect(recentDeliveriesForUser(state, 'user-b', expiry)).toHaveLength(0);
  });

  it('kasutab ilma ajaloo ja saadetiseta vanal kirjel toote aega', () => {
    const state = stateWithDelivery();
    state.activity = [];
    expect(recentDeliveriesForUser(state, 'user-b', expiry - 1)).toHaveLength(1);
    expect(recentDeliveriesForUser(state, 'user-b', expiry)).toHaveLength(0);
    state.items[0].updated_at = 'vigane';
    expect(recentDeliveriesForUser(state, 'user-b', expiry)).toHaveLength(0);
  });

  it('ei kuva teise kasutaja, kustutatud või tagasi ostetuks märgitud tooteid', () => {
    const state = stateWithDelivery();
    expect(recentDeliveriesForUser(state, 'user-a', expiry - 1)).toHaveLength(0);
    expect(recentDeliveriesForUser(state, undefined, expiry - 1)).toHaveLength(0);
    state.items[0].status = 'purchased';
    expect(recentDeliveriesForUser(state, 'user-b', expiry - 1)).toHaveLength(0);
    state.items[0].status = 'delivered';
    state.items[0].deleted_at = completedAt;
    expect(recentDeliveriesForUser(state, 'user-b', expiry - 1)).toHaveLength(0);
    state.items[0].deleted_at = undefined;
    state.lists.find((list) => list.id === state.items[0].list_id)!.deleted_at = completedAt;
    expect(recentDeliveriesForUser(state, 'user-b', expiry - 1)).toHaveLength(0);
  });
});
