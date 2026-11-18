import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseRepository } from '../src/data/SupabaseRepository';

const request = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../src/data/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return { supabase: createClient('https://example.supabase.co', 'test-public-key', {
    global: { fetch: request.fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) };
});
vi.mock('expo-auth-session', () => ({ makeRedirectUri: vi.fn() }));
vi.mock('expo-auth-session/build/QueryParams', () => ({}));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const repository = new SupabaseRepository();
const respond = (body: unknown, status = 200) => request.fetch.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

beforeEach(() => {
  request.fetch.mockReset();
  respond([{ id: 'item-a' }]);
});

describe('Supabase’i toote muutmine', () => {
  it('saadab määramise koos õige toote ja aktiivse olekuga', async () => {
    await repository.updateItem('item-a', { assigned_to: 'user-b', status: 'accepted' });
    const [url, options] = request.fetch.mock.calls[0];
    expect(new URL(url).searchParams.get('id')).toBe('eq.item-a');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ assigned_to: 'user-b', status: 'accepted' });
  });

  it('saadab Jooksvasse listi tagastamisel andmebaasile nulli, mitte ei jäta kasutajat muutmata', async () => {
    await repository.updateItem('item-a', { assigned_to: undefined, status: 'unassigned' });
    expect(JSON.parse(request.fetch.mock.calls[0][1].body)).toEqual({ assigned_to: null, status: 'unassigned' });
  });

  it('tavaline nime muutmine ei eemalda olemasolevat määrangut', async () => {
    await repository.updateItem('item-a', { name: 'Piim' });
    expect(JSON.parse(request.fetch.mock.calls[0][1].body)).toEqual({ name: 'Piim' });
  });

  it('ei teata edust, kui õiguste või kustutamise tõttu ühtegi rida ei muudetud', async () => {
    respond([]);
    await expect(repository.updateItem('item-a', { assigned_to: 'user-b', status: 'accepted' })).rejects.toThrow('Toodet ei saanud muuta');
  });

  it('annab andmebaasi määramisvea kasutajaliidesele edasi', async () => {
    respond({ message: 'permission denied', code: '42501' }, 403);
    await expect(repository.updateItem('item-a', { assigned_to: 'user-b', status: 'accepted' })).rejects.toMatchObject({ message: 'permission denied' });
  });
});
