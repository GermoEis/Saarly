import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '@/context/AppContext';
import { googleAuthEnabled } from '@/data/supabase';
import { ThemeColors } from '@/theme';
import { Avatar, Button, Field, Loading } from '@/components/ui';

type AuthView = 'login' | 'register' | 'workspace';
const PENDING_INVITE = 'saarly.pending-invite';

export default function LoginScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const params = useLocalSearchParams<{ invite?: string }>();
  const [view, setView] = useState<AuthView>(app.hasAuthSession && !app.isMember ? 'workspace' : 'login');
  const [name, setName] = useState(app.authDisplayName ?? '');
  const [email, setEmail] = useState(app.authEmail ?? '');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [securityCode, setSecurityCode] = useState(() => {
    if (typeof params.invite === 'string') return params.invite;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
    const pending = window.sessionStorage.getItem(PENDING_INVITE) ?? '';
    if (pending) window.sessionStorage.removeItem(PENDING_INVITE);
    return pending;
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [working, setWorking] = useState(false);
  const activeView: AuthView = app.hasAuthSession && !app.isMember ? 'workspace' : view;

  if (!app.ready) return <Loading />;
  if (app.currentUser && app.isMember) return <Redirect href={'/(app)/lists' as never} />;

  const run = async (action: () => Promise<void>, success?: string) => {
    setWorking(true); setError(''); setInfo('');
    try { await action(); if (success) setInfo(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Toiming ebaõnnestus.'); }
    finally { setWorking(false); }
  };

  const login = () => run(async () => {
    if (!email.trim() || !password) throw new Error('Sisesta e-post ja parool.');
    await app.signInEmail(email.trim().toLocaleLowerCase('et-EE'), password);
    setView('workspace');
  });

  const register = () => run(async () => {
    if (name.trim().length < 2) throw new Error('Sisesta oma nimi.');
    if (!email.includes('@')) throw new Error('Sisesta kehtiv e-posti aadress.');
    if (password.length < 8) throw new Error('Parool peab olema vähemalt 8 märki pikk.');
    if (password !== passwordAgain) throw new Error('Paroolid ei ole ühesugused.');
    await app.registerEmail(name.trim(), email.trim().toLocaleLowerCase('et-EE'), password);
  }, 'Konto on loodud. Nüüd loo uus grupp või liitu kutsekoodiga.');

  const join = () => run(async () => {
    const joiningName = name.trim() || app.authDisplayName?.trim() || '';
    if (joiningName.length < 2 || securityCode.trim().length < 6) throw new Error('Sisesta nimi ja kutsekood.');
    await app.joinGroup(joiningName, securityCode.trim());
  });

  const createGroup = () => run(async () => {
    if (newGroupName.trim().length < 2) throw new Error('Sisesta grupi nimi.');
    await app.createGroup(newGroupName.trim());
  });

  const google = () => run(async () => {
    if (Platform.OS === 'web' && securityCode.trim()) window.sessionStorage.setItem(PENDING_INVITE, securityCode.trim());
    await app.signInGoogle();
  });

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>S</Text></View><Text style={styles.name}>Saarly</Text><Text style={styles.tagline}>Ostunimekiri, mis jõuab koos kaubaga laevale.</Text></View>
    <View style={styles.panel}>
      {app.mode === 'demo' ? <DemoLogin app={app} styles={styles} /> : <>
        {activeView !== 'workspace' ? <View style={styles.switchRow}>
          <Pressable accessibilityRole="button" onPress={() => { setView('login'); setError(''); setInfo(''); }} style={[styles.switchButton, activeView === 'login' && styles.switchButtonActive]}><Text style={[styles.switchText, activeView === 'login' && styles.switchTextActive]}>Logi sisse</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setView('register'); setError(''); setInfo(''); }} style={[styles.switchButton, activeView === 'register' && styles.switchButtonActive]}><Text style={[styles.switchText, activeView === 'register' && styles.switchTextActive]}>Registreeru</Text></Pressable>
        </View> : null}

        {activeView === 'login' ? <>
          <Text style={styles.title}>Tere tulemast tagasi</Text>
          <Text style={styles.copy}>Logi sisse oma e-posti ja parooliga.</Text>
          <Field label="E-post" value={email} onChangeText={setEmail} placeholder="nimi@e-post.ee" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Field label="Parool" value={password} onChangeText={setPassword} placeholder="Sinu parool" secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}{info ? <Text style={styles.success}>{info}</Text> : null}
          <Button label={working ? 'Login sisse…' : 'Logi sisse'} disabled={working || !email.trim() || !password} onPress={() => void login()} />
          {googleAuthEnabled ? <GoogleButton label="Logi sisse Google’iga" disabled={working} onPress={() => void google()} /> : null}
          <Button label="Mul ei ole veel kontot" variant="ghost" onPress={() => setView('register')} />
        </> : null}

        {activeView === 'register' ? <>
          <Text style={styles.title}>Loo Saarly konto</Text>
          <Text style={styles.copy}>Konto saad luua vabalt. Pärast registreerimist saad luua oma grupi või liituda kutsekoodiga olemasoleva grupiga.</Text>
          <Field label="Sinu nimi" value={name} onChangeText={setName} placeholder="Näiteks Heino" autoCapitalize="words" />
          <Field label="E-post" value={email} onChangeText={setEmail} placeholder="nimi@e-post.ee" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Field label="Parool" value={password} onChangeText={setPassword} placeholder="Vähemalt 8 märki" secureTextEntry />
          <Field label="Parool uuesti" value={passwordAgain} onChangeText={setPasswordAgain} placeholder="Korda parooli" secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}{info ? <Text style={styles.success}>{info}</Text> : null}
          <Button label={working ? 'Loon kontot…' : 'Registreeru'} disabled={working || !name.trim() || !email.trim() || password.length < 8} onPress={() => void register()} />
          {googleAuthEnabled ? <GoogleButton label="Registreeru Google’iga" disabled={working} onPress={() => void google()} /> : null}
          <Button label="Mul on juba konto" variant="ghost" onPress={() => setView('login')} />
        </> : null}

        {activeView === 'workspace' ? <>
          <Text style={styles.title}>Vali, kuidas jätkata</Text>
          <Text style={styles.copy}>Oled sisse logitud{app.authEmail ? ' kontoga ' + app.authEmail : ''}. Saad luua oma privaatse grupi või liituda kutse saanud grupiga.</Text>
          <View style={styles.choiceBlock}>
            <Text style={styles.choiceTitle}>Liitu olemasoleva grupiga</Text>
            <Text style={styles.copy}>Sisesta administraatorilt saadud kutsekood. Sama konto võib kuuluda mitmesse gruppi.</Text>
          <Field label="Sinu nimi" value={name || app.authDisplayName || ''} onChangeText={setName} placeholder="Sisesta oma nimi" autoCapitalize="words" />
            <Field label="Kutsekood" value={securityCode} onChangeText={setSecurityCode} placeholder="Näiteks SAARLY-ABCD-1234" autoCapitalize="characters" secureTextEntry />
            <Button label={working ? 'Liitun…' : 'Liitu grupiga'} disabled={working || !name.trim() || !securityCode.trim()} onPress={() => void join()} />
          </View>
          <View style={styles.choiceBlock}>
            <Text style={styles.choiceTitle}>Loo uus grupp</Text>
            <Text style={styles.copy}>Sinust saab uue grupi administraator. Hiljem saad kutsuda sinna teisi inimesi.</Text>
            <Field label="Grupi nimi" value={newGroupName} onChangeText={setNewGroupName} placeholder="Näiteks Saare sõbrad" autoCapitalize="words" />
            <Button label={working ? 'Loon gruppi…' : 'Loo uus grupp'} disabled={working || newGroupName.trim().length < 2} onPress={() => void createGroup()} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}{info ? <Text style={styles.success}>{info}</Text> : null}
          <Button label="Logi sellelt kontolt välja" variant="ghost" onPress={() => void app.signOut().then(() => setView('login'))} />
        </> : null}
      </>}
    </View>
    <Text style={styles.foot}>{app.mode === 'demo' ? 'Pärisandmeid ei saadeta. Demo salvestub ainult sellesse seadmesse.' : 'Ühendus on kaitstud. Näed ainult parajasti valitud grupi andmeid.'}</Text>
  </ScrollView>;
}

function GoogleButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [googleStyles.button, pressed && googleStyles.pressed, disabled && googleStyles.disabled]}>
    <GoogleLogo />
    <Text style={googleStyles.text}>{label}</Text>
    <View style={googleStyles.spacer} />
  </Pressable>;
}

function GoogleLogo() {
  return <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityLabel="Google">
    <Path fill="#4285F4" d="M21.58 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.96-4.33 2.96-7.4Z" />
    <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
    <Path fill="#FBBC05" d="M6.4 13.92a6.02 6.02 0 0 1 0-3.84V7.46H3.05a10 10 0 0 0 0 9.08l3.35-2.62Z" />
    <Path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.46l3.35 2.62c.8-2.37 3-4.13 5.6-4.13Z" />
  </Svg>;
}

function DemoLogin({ app, styles }: { app: ReturnType<typeof useApp>; styles: ReturnType<typeof makeStyles> }) {
  return <><View style={styles.demoPill}><Text style={styles.demoPillText}>● DEMOREŽIIM</Text></View><Text style={styles.title}>Proovi Saarlyt</Text><Text style={styles.copy}>Vali näidiskasutaja. Päris kontot demorežiimis ei looda.</Text><View style={styles.users}>{app.state.profiles.filter((profile) => app.state.groupMembers.some((value) => value.profile_id === profile.id)).map((profile) => <Pressable key={profile.id} accessibilityRole="button" accessibilityLabel={'Sisene kasutajana ' + profile.display_name} onPress={() => { app.signIn(profile.id); router.replace('/(app)/lists' as never); }} style={({ pressed }) => [styles.user, pressed && { opacity: .7 }]}><Avatar name={profile.display_name} color={profile.avatar_color} size={52} /><View style={{ flex: 1 }}><Text style={styles.userName}>{profile.display_name}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}</View><Button label="Taasta näidisandmed" variant="ghost" icon="↻" onPress={app.resetDemo} /></>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  brand: { alignItems: 'center', maxWidth: 470 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.secondaryBorder, boxShadow: '0 10px 28px rgba(15, 122, 87, .18)' },
  logoText: { color: colors.onPrimary, fontSize: 39, lineHeight: 45, fontWeight: '900', letterSpacing: -1 },
  name: { fontSize: 36, lineHeight: 43, color: colors.ink, fontWeight: '900', letterSpacing: -1, marginTop: 12 },
  tagline: { fontSize: 17, color: colors.muted, textAlign: 'center', lineHeight: 25, marginTop: 2 },
  panel: { width: '100%', maxWidth: 540, borderWidth: 1, borderColor: colors.border, borderRadius: 26, backgroundColor: colors.surface, padding: 25, gap: 17, boxShadow: '0 2px 4px rgba(20, 35, 28, .04), 0 18px 50px rgba(20, 64, 45, .10)' },
  switchRow: { flexDirection: 'row', gap: 6, backgroundColor: colors.subtle, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border },
  switchButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  switchButtonActive: { backgroundColor: colors.primary },
  switchText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  switchTextActive: { color: colors.onPrimary },
  demoPill: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  demoPillText: { color: colors.primaryDark, fontSize: 12, letterSpacing: 1, fontWeight: '900' },
  title: { fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -.45, color: colors.ink },
  copy: { fontSize: 16, lineHeight: 24, color: colors.muted },
  choiceBlock: { gap: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 17, backgroundColor: colors.subtle },
  choiceTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -.2, color: colors.ink },
  error: { color: colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  success: { color: colors.primaryDark, backgroundColor: colors.primarySoft, padding: 12, borderRadius: 10, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  googleHelp: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  users: { gap: 10 },
  user: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.subtle, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border },
  userName: { fontSize: 17, fontWeight: '800', color: colors.ink },
  arrow: { color: colors.primary, fontSize: 31, paddingRight: 6 },
  foot: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});

const googleStyles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#747775', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { flex: 1, color: '#1F1F1F', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  spacer: { width: 20 },
  pressed: { backgroundColor: '#F8FAFF' },
  disabled: { opacity: .45 },
});
