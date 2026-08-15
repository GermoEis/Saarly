# Saarly

Saarly on väikese privaatse grupi ühine ostu- ja kohaletoimetamise rakendus. Kõik grupiliikmed saavad nimekirju, kategooriaid ja tooteid luua ning hallata, võtta tooteid endale, need osta ja lisada laeva ning üleandmise info. Projekt on päris Expo Routeri rakendus ühise iOS-i, Androidi ja veebi koodibaasiga.

**Avalik veebiversioon:** [saarly.pages.dev](https://saarly.pages.dev)

## Põhivõimalused

- privaatsed grupid, kutsed ja ühe konto kuulumine mitmesse gruppi;
- ühised ostunimekirjad, kategooriad ja reaalajas uuenev Jooksev list;
- toodete määramine, fotod, ostuolekud ja tegevusajalugu;
- varem lisatud toodete soovitused, 10-sekundiline tagasivõtmine ja 30 päeva prügikast demorežiimis;
- laeva ning kauba üleandmise info;
- grupisisesed märkmed, teavitused ja privaatsed arveldused;
- hele ja tume režiim ning telefonile ja arvutile kohanduv kasutajaliides;
- Supabase Auth, PostgreSQL, Realtime, Storage ja Row Level Security;
- ilma pilveteenuseta töötav `localStorage`-i demorežiim.

## Tehnoloogiad

Expo SDK 57 · React Native · TypeScript · Expo Router · Supabase · Vitest · Cloudflare Pages

## Kiirkäivitus Macis

Vaja on Node.js 22.13 või uuemat (Expo SDK 57 nõue).

```bash
npm install
npx expo start --web
```

Supabase'i võtmeid pole demo jaoks vaja. Ava terminalis näidatud veebiaadress ja vali kiireks testiks **Kasutaja A**, **Kasutaja B**, **Kasutaja C** või **Kasutaja D**. Demo salvestub brauseri `localStorage`-isse. Sama brauseri kaks akent sünkroonivad muudatusi `BroadcastChannel` API kaudu.

Kui vana demoseis põhjustab segadust, vali kasutaja seadetest **Taasta näidisandmed**.

Iga kasutaja saab vaates **Kasutajad ja seaded → Välimus** valida heleda või tumeda režiimi. Demorežiimis salvestub eelistus kasutaja profiiliga brauseri `localStorage`-isse; Supabase’i režiimis salvestub see `profiles.theme_preference` väljale. Seetõttu võib iga grupiliige kasutada teistest erinevat välimust.

Pärisrežiimis saab uus kasutaja luua konto nime, e-posti ja vähemalt 8-märgilise parooliga või Google’i kaudu. Konto loomine ei nõua grupikoodi. Pärast sisselogimist saab kasutaja valida **Loo uus grupp** või **Liitu grupiga** ja sisestada administraatorilt saadud kutsekoodi. Üks konto võib kuuluda mitmesse gruppi ning aktiivset gruppi saab vahetada vaates **Kasutajad ja seaded → Minu grupid**.

## Mida demos proovida

1. Sisene kasutajana **Kasutaja A**, ava „Kaubad 12. augustiks“, lisa kategooria ja toode ning määra kaup kasutajale.
2. Ava seaded ja vaheta **Kasutaja B** rolli. „Minule määratud“ all on määratud tooted kohe aktiivsed: eraldi vastuvõtmist pole vaja ning saad vajutada kohe **Ostetud**. Kui sa ei saa praegu midagi võtta, vabastab vastav nupp kõik ostmata määrangud.
3. Ava „Jooksev list“. Iga grupiliige saab nupuga **Lisa asi** lisada kauba otse sinna ilma eraldi ostunimekirja loomata või vajutada vaba toote juures **Võtan endale**.
4. Märgi toode **Ostetud** või **Poes ei olnud**. Kui kõik sinu määratud asjad on ostetud, ilmub saadetise juurde nupp **Laevale viidud**.
5. Laevainfo on nimekirja ülaosas. Kui kõik sinu kaubad on ostetud, määra laev ja märgi saadetis laevale viiduks. Kasutaja A saab teavituse alles siis, kui toodet ei leitud või saadetis märgiti laevale viiduks; üksiku toote ostetuks märkimine ega laevainfo kavandi salvestamine teadet ei saada.
6. Ava kaks brauseriakent eri kasutajatega ja kontrolli reaalajas sünkroonimist.
7. Sisene **Kasutaja C** rollis ja ava kasutajate seaded. Muuda grupi nime, sisesta kutsutava nimi ning jaga ühekordset kutset. Kutsutu lisatakse liikmeks alles siis, kui ta logib oma kontoga sisse ja lunastab kutsekoodi. Kasutaja C saab liikme ka eemaldada; tema pooleliolevad tooted liiguvad tagasi „Jooksvasse listi“.
8. Ava nimekirjade avalehelt **Arveldused**. Lisa summa teisele grupiliikmele ja soovi korral selgitus. Võlgnik saab märkida summa makstuks ning raha saaja kinnitab laekumise; raha saaja võib avatud arvelduse ka kohe ise nupuga **Märgi tasutuks** lõpetada. Kuupäeva ei sisestata. Arveldust näevad ainult selle kaks osapoolt, mitte teised grupiliikmed ega osapooleks mitteolev administraator.
9. Ava uue toote vorm ja kirjuta näiteks **Pii**. Vali pakutud „Piim“ ning muuda enne lisamist vabalt nime, kogust, ühikut, märkust või kategooriat.
10. Märgi toode ostetuks või nimekiri arhiveerituks ja kasuta 10 sekundi jooksul ekraani all olevat nuppu **Võta tagasi**. Kustutatud tooted ja nimekirjad leiad vaate **Arhiiv → Prügikast** kaudu ning saad need 30 päeva jooksul taastada.
11. Vaates **Kasutajad ja seaded → Telefoniteavitused** saad anda veebiteavituste loa ning saata prooviteavituse. Pärisrežiimis salvestatakse selle seadme veebipushi tellimus Supabase’i ja server saadab uue rakendusesisese teavituse ka suletud PWA-le. iPhone’is lisa Saarly esmalt avakuvale, ava Saarly ikoonist ning vajuta loa nuppu.

Toote kaardile vajutamine avab detaili koos foto, muutmise, määramise, kategooriasse liigutamise ja tegevusajalooga. Foto saab valida või teha juba uue toote vormis ning iga foto salvestatakse püsivalt oma toote külge. Kõik grupiliikmed saavad kategooriaid ümber nimetada ning üles/alla liigutada. Kustutamine ja arhiveerimine küsivad kinnitust. Administraatori eriõigus on piiratud grupi nime, kutsete ja liikmete haldamisega.

## Telefonis katsetamine

```bash
npm install
npx expo start
```

- **iPhone:** paigalda App Store'ist Expo Go, veendu et telefon ja Mac on samas võrgus ning skanni kaamera abil terminali QR-kood. iOS-i simulaatoris vajuta terminalis `i`.
- **Android:** paigalda Google Playst Expo Go ja skanni Expo Go sees QR-kood. Android Emulatori korral vajuta terminalis `a`.
- Kui kohtvõrk QR-ühendust blokeerib, kasuta `npx expo start --tunnel`.

Fotovalik töötab telefonis galeriist ja kaamerast, veebis failivalijast. Päris push-teavituste testimiseks on Androidis vaja development buildi, mitte Expo Go'd.

## Kontrollid

```bash
npm test
npm run typecheck
npx expo export --platform web
```

Testid katavad sama ujuva toote samaaegse võtmise, keeldumise, poest puudumise ajaloo, nimekirja muutmise ja turvalise kustutamise, ostja seose säilimise, grupiisolatsiooni, laevateavituse teksti ning arvelduste privaatsuse, tasumise ja tühistamise voo. Responsiivset telefonivaadet ja töölauavaadet kontrollitakse enne väljastamist päris veebirakenduses.

## Supabase'i kasutuselevõtt

1. Loo Supabase'i projekt ja paigalda [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
2. Seo projekt: `supabase link --project-ref <project-ref>`.
3. Rakenda skeem: `supabase db push`.
4. Luba Supabase Dashboardis **Authentication → Sign In / Providers** all uute kasutajate registreerimine, e-postiga sisselogimine ja **Allow manual linking**. Väikese grupi MVP kiire registreerimise jaoks võib **Confirm email** olla välja lülitatud; avaliku teenuse puhul lülita e-posti kinnitamine tagasi sisse.
5. Kopeeri `.env.example` failiks `.env` ja lisa projekti URL ning **publishable key** (või anon key vanemas projektis).
6. Sea `EXPO_PUBLIC_APP_MODE=supabase`. Google OAuthi nupp kuvatakse ainult siis, kui Google provider on Supabase’is seadistatud ja `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Google Cloudis lisa veebirakenduse originiks `https://saarly.pages.dev` ning callback URL-iks Supabase’i Google provideri lehel näidatud `https://<project-ref>.supabase.co/auth/v1/callback`. Supabase’i redirect allow listi lisa `https://saarly.pages.dev/**` ja tulevase mobiilirakenduse jaoks `saarly://**`.

Pärast konto loomist saab kasutaja ise uue grupi luua. Grupi looja saab administraatorirolli ja algkategooriad. Teiste lisamiseks loob administraator rakenduse **Kasutajad ja seaded → Kutsu uus kasutaja** vaates isikliku kutse. Kutse kehtib 30 päeva, on ühekordne ja seda saab enne kasutamist tühistada. Andmebaasis hoitakse ainult koodi SHA-256 sõrmejälge, mitte jagatavat koodi ennast.

Kasutaja tekib `group_members` tabelisse alles kutse lunastamisel. Sama `profile_id` võib olla mitme grupi liige; kõiki päringuid piirab valitud `group_id` ja RLS kontrollib liikmesust serveris. Vanad ühised grupikoodid töötavad ülemineku ajaks endiselt, kuid uued kutsed kasutavad turvalisemat `group_invites` lahendust.

Migratsioon `supabase/migrations/20260807120000_initial_saarly.sql` loob kõik domeenitabelid, indeksid, Realtime publication'i, privaatse `item-images` Storage bucketi, RLS-poliitikad ning kolm serveripoolset turvalist RPC-d:

- `claim_floating_item` — atomaarne võtmine; ainult esimene sama toodet võtva kasutaja päring õnnestub;
- `respond_to_assignment` — määratud tootega nõustumine või keeldumine;
- `mark_item_unavailable` — katse säilitamine ja toote tagastamine ujuvasse nimekirja.
- `create_quick_item` — peidetud grupisisese Jooksva listi loomine ja sinna kauba atomaarne lisamine;
- `remove_group_member` — administraatori atomaarne liikme eemaldamine, pooleliolevate määrangute vabastamine ja ajaloo säilitamine.
- `create_group` — loob grupi, administraatoriliikmesuse ja algkategooriad ühe tehinguna;
- `create_group_invite` — loob ühekordse 30 päeva kehtiva kutsekoodi;
- `redeem_group_invite` — liidab sisselogitud konto grupiga atomaarse operatsioonina;
- `revoke_group_invite` — tühistab kasutamata kutse.
- `delete_shopping_list_preserving_floating` — tõstab vabad tooted enne nimekirja kustutamist püsivasse Jooksvasse listi; funktsioon töötab kutsuja õigustes ja järgib RLS-i;
- `create_settlement` — loob raha saaja ja võlgniku vahelise privaatse arvelduse ning teavitab võlgnikku;
- `mark_settlement_paid`, `confirm_settlement_paid` ja `cancel_settlement` — muudavad arvelduse olekut ainult õige osapoole nimel. `settlements` tabeli RLS lubab kirjet lugeda ainult kahel osapoolel.

`src/data/SupabaseRepository.ts` sisaldab Authi, mitme grupi andmete laadimise, RPC-de, Realtime'i ja Storage'i adapterit. Demorežiim kasutab sama `src/types/domain.ts` domeenimudelit, mistõttu UI ei sõltu andmebaasi teostusest. Aktiivse grupi valik salvestatakse kasutaja kaupa seadmesse ja Realtime’i tellimus vahetatakse koos grupiga.

Ära pane kliendirakendusse `service_role` võtit ega kutsekoode. Kõik `EXPO_PUBLIC_` väärtused on kasutajale loetavad. `.env` on `.gitignore` failis ja rakendus kasutab ainult avalikku `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` väärtust. Kõik avalikud tabelid on RLS-iga kaitstud ning pildid on privaatses bucketis teega `group_id/item_id/file`.

## Struktuur

```text
src/app/                 Expo Routeri vaated ja telefoni tab-menüü
src/components/          korduvkasutatavad UI- ja tootekomponendid
src/context/             rakenduse seisund ja demo põhivood
src/data/                demoandmed, puhas äriloogika, salvestus, Supabase'i adapter
src/services/push.ts     Expo push-tokeni järgmise etapi struktuur
src/types/domain.ts      kõigi põhiobjektide TypeScripti tüübid
supabase/migrations/     PostgreSQL, RLS, Realtime, Storage ja RPC-d
tests/                   Vitesti äriloogika testid
```

## Edasine avaldamine

Enne App Store'i või Google Playsse saatmist lisa EAS-i projekt (`eas init`), päris ikoonid/splash-varad, privaatsuspoliitika, push-teenuse serverifunktsioon, e-posti/kutse onboarding ning E2E-testid päris Supabase'i testprojektiga. Domeenimudel, `push_tokens`, Storage ja RLS on selleks juba ette valmistatud.
