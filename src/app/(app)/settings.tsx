import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Avatar, Button, Card, Field, Page } from '@/components/ui';
import { ThemeColors } from '@/theme';

export default function SettingsScreen() {
  const app = useApp();
  return <SettingsContent key={app.activeGroupId ?? 'no-group'} />;
}

function SettingsContent() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const group = app.state.groups[0];
  const [groupName, setGroupName] = useState(group?.name ?? 'Meie grupp');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [groupWorking, setGroupWorking] = useState(false);
  const [error, setError] = useState('');
  const [accountEmail, setAccountEmail] = useState(app.authEmail ?? '');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordAgain, setAccountPasswordAgain] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const effectiveAccountEmail = accountEmail || app.authEmail || '';

  const members = useMemo(() => app.state.groupMembers.map((member) => ({
    member,
    profile: app.state.profiles.find((profile) => profile.id === member.profile_id),
  })).filter((entry) => entry.profile), [app.state.groupMembers, app.state.profiles]);

  const remove = (profileId: string, displayName: string) => {
    const run = () => {
      setError('');
      void app.removeMember(profileId).catch((reason) => setError(reason.message ?? 'Kasutaja eemaldamine ebaõnnestus.'));
    };
    const message = `${displayName} eemaldatakse grupist. Tema pooleliolevad tooted liiguvad tagasi jooksvasse listi.`;
    if (Platform.OS === 'web') { if (window.confirm(message)) run(); }
    else Alert.alert('Eemalda kasutaja?', message, [{ text: 'Katkesta', style: 'cancel' }, { text: 'Eemalda', style: 'destructive', onPress: run }]);
  };

  const shareInvite = () => {
    const cleanName = inviteName.trim();
    setError(''); setInviteMessage(''); setGroupWorking(true);
    void app.createInvite(cleanName).then(async ({ code, expiresAt }) => {
      const link = `https://saarly.pages.dev/?invite=${encodeURIComponent(code)}`;
      const message = `${cleanName}, sind kutsuti Saarly gruppi „${group?.name ?? groupName.trim()}“. Loo konto või logi sisse aadressil ${link} ja liitu kutsekoodiga ${code}. Kutse kehtib kuni ${new Date(expiresAt).toLocaleDateString('et-EE')}.`;
      setInviteMessage(`Kutsekood: ${code}`);
      await Share.share({ title: 'Saarly kutse', message });
    }).catch((reason) => setError(reason.message ?? 'Kutse saatmine ebaõnnestus.')).finally(() => setGroupWorking(false));
  };

  const createNewGroup = () => {
    setError(''); setGroupWorking(true);
    void app.createGroup(newGroupName).then(() => setNewGroupName('')).catch((reason) => setError(reason.message ?? 'Grupi loomine ebaõnnestus.')).finally(() => setGroupWorking(false));
  };

  const joinAnotherGroup = () => {
    setError(''); setGroupWorking(true);
    void app.joinGroup(app.currentUser?.display_name ?? app.authDisplayName ?? 'Kasutaja', joinCode).then(() => setJoinCode('')).catch((reason) => setError(reason.message ?? 'Grupiga liitumine ebaõnnestus.')).finally(() => setGroupWorking(false));
  };

  const saveAccount = () => {
    setAccountError(''); setAccountMessage(''); setAccountFormOpen(true);
    if (!effectiveAccountEmail.includes('@')) { setAccountError('Sisesta kehtiv e-posti aadress.'); return; }
    if (accountPassword.length < 8) { setAccountError('Parool peab olema vähemalt 8 märki pikk.'); return; }
    if (accountPassword !== accountPasswordAgain) { setAccountError('Paroolid ei ole ühesugused.'); return; }
    setAccountSaving(true);
    void app.linkEmailAccount(effectiveAccountEmail.trim().toLocaleLowerCase('et-EE'), accountPassword)
      .then(({ confirmationRequired }) => {
        if (confirmationRequired) {
          setAccountMessage(`E-post on lisatud. Kinnita aadressile ${effectiveAccountEmail.trim()} saadetud kiri ja vajuta seejärel uuesti „Seo e-post ja parool“.`);
          return;
        }
        setAccountPassword(''); setAccountPasswordAgain(''); setAccountFormOpen(false);
        setAccountMessage('Konto on seotud. Nüüd saad teistes seadmetes e-posti ja parooliga sisse logida.');
      })
      .catch((reason) => setAccountError(reason.message ?? 'Konto sidumine ebaõnnestus.'))
      .finally(() => setAccountSaving(false));
  };

  return <Page title="Kasutajad ja seaded" subtitle="Halda privaatset tööruumi, liikmeid ja kutseid.">
    {app.mode === 'supabase' ? <Card>
      <Text style={styles.section}>Sisselogimiskonto</Text>
      {app.isAnonymousAccount ? <>
        <Text style={styles.copy}>Sinu praegune lihtkonto on seotud selle seadmega. Lisa e-post ja parool, et sama kasutajaga igas telefonis sisse logida.</Text>
      </> : <>
        <Text style={styles.copy}>Oled sisse logitud kontoga {app.authEmail ?? 'Google’i konto'}.</Text>
        <View style={styles.accountActions}>
          <View style={styles.accountAction}><Button label={accountFormOpen ? 'Peida parooli vorm' : 'Muuda parooli'} variant="secondary" onPress={() => { setAccountError(''); setAccountMessage(''); setAccountFormOpen((open) => !open); }} /></View>
          <View style={styles.accountAction}><Button label="Logi välja" variant="ghost" onPress={() => void app.signOut().then(() => router.replace('/'))} /></View>
        </View>
      </>}
      {(app.isAnonymousAccount || accountFormOpen) ? <>
        <Field label="E-post" value={effectiveAccountEmail} onChangeText={setAccountEmail} placeholder="nimi@e-post.ee" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Field label="Uus parool" value={accountPassword} onChangeText={setAccountPassword} placeholder="Vähemalt 8 märki" secureTextEntry />
        <Field label="Parool uuesti" value={accountPasswordAgain} onChangeText={setAccountPasswordAgain} placeholder="Korda parooli" secureTextEntry />
        <Button label={accountSaving ? 'Muudan parooli…' : 'Muuda parooli'} disabled={accountSaving || !effectiveAccountEmail.trim() || accountPassword.length < 8} onPress={saveAccount} />
        {accountSaving ? <Text style={styles.progress}>Ühendan kontot turvaliselt…</Text> : null}
      </> : null}
      {accountError ? <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text> : null}
      {accountMessage ? <Text style={styles.success}>{accountMessage}</Text> : null}
    </Card> : null}
    <Card>
      <Text style={styles.section}>Välimus</Text>
      <Text style={styles.copy}>Valik salvestatakse sinu kasutajale ja rakendub järgmisel avamisel automaatselt.</Text>
      <View style={styles.themeActions}><View style={styles.themeButton}><Button label="Hele režiim" icon="☀" variant={app.themeMode === 'light' ? 'primary' : 'secondary'} onPress={() => void app.setThemeMode('light')} /></View><View style={styles.themeButton}><Button label="Tume režiim" icon="☾" variant={app.themeMode === 'dark' ? 'primary' : 'secondary'} onPress={() => void app.setThemeMode('dark')} /></View></View>
    </Card>
    {app.mode === 'supabase' ? <Card>
      <Text style={styles.section}>Minu grupid</Text>
      <Text style={styles.copy}>Vali grupp, mille nimekirju, märkmeid ja teavitusi praegu näed.</Text>
      <View style={styles.groupChoices}>
        {app.availableGroups.map((availableGroup) => <View key={availableGroup.id} style={styles.groupChoice}>
          <Button label={availableGroup.name} icon={availableGroup.id === app.activeGroupId ? '✓' : '○'} variant={availableGroup.id === app.activeGroupId ? 'primary' : 'secondary'} disabled={groupWorking} onPress={() => { setError(''); setGroupWorking(true); void app.switchGroup(availableGroup.id).catch((reason) => setError(reason.message ?? 'Grupi vahetamine ebaõnnestus.')).finally(() => setGroupWorking(false)); }} />
        </View>)}
      </View>
      <View style={styles.divider} />
      <Text style={styles.choiceTitle}>Liitu veel ühe grupiga</Text>
      <Field label="Kutsekood" value={joinCode} onChangeText={setJoinCode} placeholder="Näiteks SAARLY-ABCD-1234" autoCapitalize="characters" secureTextEntry />
      <Button label={groupWorking ? 'Palun oota…' : 'Liitu grupiga'} disabled={groupWorking || joinCode.trim().length < 6} onPress={joinAnotherGroup} />
      <View style={styles.divider} />
      <Text style={styles.choiceTitle}>Loo uus grupp</Text>
      <Field label="Uue grupi nimi" value={newGroupName} onChangeText={setNewGroupName} placeholder="Näiteks Saare sõbrad" autoCapitalize="words" />
      <Button label={groupWorking ? 'Palun oota…' : 'Loo uus grupp'} disabled={groupWorking || newGroupName.trim().length < 2} onPress={createNewGroup} />
    </Card> : null}
    {app.isAdmin ? <Card>
        <Text style={styles.section}>Tööruumi nimi</Text>
        <Text style={styles.copy}>Seda nime näevad kõik grupi liikmed.</Text>
        <Field label="Grupi nimi" value={groupName} onChangeText={setGroupName} placeholder="Näiteks Meie grupp" />
        <Button label="Salvesta nimi" icon="✓" disabled={!groupName.trim() || groupName.trim() === group?.name} onPress={() => { setError(''); void app.renameGroup(groupName).catch((reason) => setError(reason.message ?? 'Nime salvestamine ebaõnnestus.')); }} />
      </Card> : null}
    <Card>
      <Text style={styles.section}>Kutsu uus kasutaja</Text>
      <Text style={styles.copy}>Iga grupi liige saab saata ühekordse kutse. Kutse aegub 30 päeva pärast ja kasutaja ilmub liikmete hulka alles siis, kui ta on kontoga sisse loginud ning kutsekoodi sisestanud.</Text>
      <Field label="Kutsutava nimi" value={inviteName} onChangeText={setInviteName} placeholder="Näiteks Heino" autoCapitalize="words" />
      <Button label={groupWorking ? 'Loon kutset…' : 'Loo ja saada kutse'} icon="↗" disabled={groupWorking || inviteName.trim().length < 2} onPress={shareInvite} />
      {inviteMessage ? <Text selectable style={styles.success}>{inviteMessage}</Text> : null}
      {app.groupInvites.length ? <View style={styles.invites}>
        <Text style={styles.choiceTitle}>Viimased kutsed</Text>
        {app.groupInvites.slice(0, 8).map((invite) => {
          const status = invite.revoked_at ? 'Tühistatud' : invite.used_at ? 'Kasutatud' : new Date(invite.expires_at) < new Date() ? 'Aegunud' : `Kehtib kuni ${new Date(invite.expires_at).toLocaleDateString('et-EE')}`;
          const activeInvite = !invite.revoked_at && !invite.used_at && new Date(invite.expires_at) >= new Date();
          const canRevoke = app.isAdmin || invite.created_by === app.currentUser?.id;
          return <View key={invite.id} style={styles.inviteRow}><View style={styles.identity}><Text style={styles.userName}>{invite.invitee_name || 'Nimeta kutse'}</Text><Text style={styles.role}>{status}</Text></View>{activeInvite && canRevoke ? <Button label="Tühista" variant="danger" onPress={() => { setError(''); void app.revokeInvite(invite.id).catch((reason) => setError(reason.message ?? 'Kutse tühistamine ebaõnnestus.')); }} /> : null}</View>;
        })}
      </View> : null}
    </Card>

    {error ? <Card style={styles.errorCard}><Text style={styles.error}>{error}</Text></Card> : null}

    <Card>
      <Text style={styles.section}>{group?.name ?? 'Meie grupp'}</Text>
      <Text style={styles.memberCount}>{members.length} {members.length === 1 ? 'liige' : 'liiget'}</Text>
      {members.map(({ member, profile }) => {
        if (!profile) return null;
        const active = profile.id === app.currentUser?.id;
        return <View key={member.id} style={[styles.user, active && styles.active]}>
          <Avatar name={profile.display_name} color={profile.avatar_color} />
          <View style={styles.identity}><Text style={styles.userName}>{profile.display_name} {active ? '· sina' : ''}</Text>{member.role === 'admin' ? <Text style={styles.role}>Administraator</Text> : null}</View>
          <View style={styles.actions}>
            {app.mode === 'demo' && !active ? <Button label="Vaheta" variant="secondary" onPress={() => { app.signIn(profile.id); router.replace('/(app)/lists' as never); }} /> : null}
            {app.isAdmin && member.role === 'buyer' && !active ? <Button label="Eemalda" variant="danger" onPress={() => remove(profile.id, profile.display_name)} /> : null}
          </View>
        </View>;
      })}
    </Card>

    {app.mode === 'demo' ? <Card>
      <Text style={styles.section}>Demorežiim</Text>
      <Text style={styles.copy}>Andmed püsivad selles brauseris. Teises aknas tehtud muudatused jõuavad siia reaalajas.</Text>
      <Button label="Taasta näidisandmed" icon="↻" variant="danger" onPress={app.resetDemo} />
      <Button label="Logi välja" variant="ghost" onPress={() => { void app.signOut(); router.replace('/'); }} />
    </Card> : null}
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { fontSize: 20, fontWeight: '700', color: colors.ink },
  memberCount: { color: colors.muted, fontSize: 15, marginTop: -7 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, flexWrap: 'wrap' },
  active: { backgroundColor: colors.subtle },
  identity: { flex: 1, minWidth: 150 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  themeButton: { flexGrow: 1, minWidth: 170 },
  accountActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  accountAction: { flexGrow: 1, minWidth: 190 },
  groupChoices: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  groupChoice: { minWidth: 160, flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  choiceTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  invites: { gap: 9, marginTop: 5 },
  inviteRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  role: { color: colors.muted, fontSize: 14 },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  error: { color: colors.danger, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  accountError: { color: colors.danger, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, padding: 12, borderRadius: 10, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  progress: { color: colors.muted, fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  success: { color: colors.primaryDark, backgroundColor: colors.primarySoft, padding: 12, borderRadius: 10, fontSize: 15, lineHeight: 22, fontWeight: '700' },
});
