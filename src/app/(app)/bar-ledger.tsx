import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Field, Page, Sheet } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { barDebtorCreditBalance, barDebtorSuggestions, barEntryItems, barEntryPaid, barEntryRemaining, barEntryVisibleTo, barPaymentMethodLabel, barProductSuggestions, BarProductSuggestion, formatBarEuros, roundMoney } from '@/data/barLedger';
import { ThemeColors } from '@/theme';
import { BarLedgerEntry, BarPaymentMethod, BarProduct } from '@/types/domain';

type ViewMode = 'active' | 'history' | 'products';
type FormLine = { id: string; productId?: string; selectedSuggestion?: string; name: string; quantity: string; unitPrice: string };

const lineId = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const emptyLine = (): FormLine => ({ id: lineId(), name: '', quantity: '1', unitPrice: '' });
const numberValue = (value: string) => Number(value.trim().replace(',', '.'));
const paymentMethods: { value: BarPaymentMethod; label: string }[] = [{ value: 'cash', label: 'Sulas' }, { value: 'transfer', label: 'Ülekandega' }];
const localDateValue = (iso = new Date().toISOString()) => {
  const value = new Date(iso);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
};
const parseLocalDate = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function ask(title: string, message: string, action: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) action(); return; }
  Alert.alert(title, message, [{ text: 'Loobu', style: 'cancel' }, { text: 'Kinnita', style: 'destructive', onPress: action }]);
}

function showMessage(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Saarly', message);
}

export default function BarLedgerScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const userId = app.currentUser!.id;
  const [mode, setMode] = useState<ViewMode>('active');
  const [ledgerUserId, setLedgerUserId] = useState(userId);
  const [ledgerPickerOpen, setLedgerPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [debtorId, setDebtorId] = useState<string | undefined>();
  const [debtorName, setDebtorName] = useState('');
  const [debtorContact, setDebtorContact] = useState('');
  const [occurredAt, setOccurredAt] = useState(localDateValue());
  const [entryNote, setEntryNote] = useState('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState<BarPaymentMethod>('cash');
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);
  const [paymentEntryId, setPaymentEntryId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateValue());
  const [paymentNote, setPaymentNote] = useState('');
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditOwnerId, setCreditOwnerId] = useState(userId);
  const [creditDebtorId, setCreditDebtorId] = useState<string | undefined>();
  const [creditName, setCreditName] = useState('');
  const [creditContact, setCreditContact] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDate, setCreditDate] = useState(localDateValue());
  const [creditNote, setCreditNote] = useState('');
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<BarPaymentMethod>('cash');
  const [productOpen, setProductOpen] = useState(false);
  const [productId, setProductId] = useState<string | undefined>();
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedDebtors, setExpandedDebtors] = useState<Record<string, boolean>>({});

  const visibleEntries = useMemo(() => app.state.barLedgerEntries
    .filter((entry) => barEntryVisibleTo(app.state, entry, userId)), [app.state, userId]);
  const filteredEntries = useMemo(() => visibleEntries
    .filter((entry) => entry.owner_id === ledgerUserId)
    .filter((entry) => mode === 'active' ? entry.status === 'open' : mode === 'history' ? entry.status !== 'open' : false)
    .filter((entry) => {
      const debtor = app.state.barDebtors.find((value) => value.id === entry.debtor_id);
      return !query.trim() || `${debtor?.name ?? ''} ${debtor?.contact ?? ''} ${entry.note ?? ''}`.toLocaleLowerCase('et-EE').includes(query.trim().toLocaleLowerCase('et-EE'));
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)), [app.state.barDebtors, ledgerUserId, mode, query, visibleEntries]);
  const activeEntries = visibleEntries.filter((entry) => entry.owner_id === ledgerUserId && entry.status === 'open');
  const activeTotal = roundMoney(activeEntries.reduce((sum, entry) => sum + barEntryRemaining(app.state, entry), 0));
  const activeDebtors = new Set(activeEntries.map((entry) => entry.debtor_id)).size;
  const visibleDebtors = app.state.barDebtors.filter((debtor) => debtor.owner_id === ledgerUserId && (debtor.owner_id === userId || app.isAdmin));
  const debtorGroups = visibleDebtors
    .map((debtor) => ({ debtor, entries: filteredEntries.filter((entry) => entry.debtor_id === debtor.id), credit: barDebtorCreditBalance(app.state, debtor.id) }))
    .filter((group) => mode === 'active' ? group.entries.length > 0 || group.credit > 0 : group.entries.length > 0)
    .filter((group) => !query.trim() || group.entries.length > 0 || `${group.debtor.name} ${group.debtor.contact ?? ''}`.toLocaleLowerCase('et-EE').includes(query.trim().toLocaleLowerCase('et-EE')))
    .sort((a, b) => a.debtor.name.localeCompare(b.debtor.name, 'et'));
  const totalCredit = roundMoney(visibleDebtors.reduce((sum, debtor) => sum + Math.max(0, barDebtorCreditBalance(app.state, debtor.id)), 0));
  const owners = app.state.groupMembers.map((member) => app.state.profiles.find((profile) => profile.id === member.profile_id)).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  const selectedLedgerName = owners.find((owner) => owner.id === ledgerUserId)?.display_name ?? 'Kasutaja';
  const isOwnLedger = ledgerUserId === userId;
  const editingEntry = app.state.barLedgerEntries.find((entry) => entry.id === editingId);
  const formOwnerId = editingEntry?.owner_id ?? userId;
  const matchingDebtors = barDebtorSuggestions(app.state, formOwnerId, debtorName);
  const paymentEntry = app.state.barLedgerEntries.find((entry) => entry.id === paymentEntryId);
  const matchingCreditDebtors = barDebtorSuggestions(app.state, creditOwnerId, creditName);

  const resetEntry = () => {
    setEditingId(null); setDebtorId(undefined); setDebtorName(''); setDebtorContact(''); setOccurredAt(localDateValue()); setEntryNote(''); setEntryPaymentMethod('cash'); setLines([emptyLine()]); setFormError('');
  };
  const openNew = () => { resetEntry(); setEntryOpen(true); };
  const openEdit = (entry: BarLedgerEntry) => {
    const debtor = app.state.barDebtors.find((value) => value.id === entry.debtor_id);
    setEditingId(entry.id); setDebtorId(entry.debtor_id); setDebtorName(debtor?.name ?? ''); setDebtorContact(debtor?.contact ?? ''); setOccurredAt(localDateValue(entry.occurred_at)); setEntryNote(entry.note ?? ''); setEntryPaymentMethod(entry.payment_method ?? 'cash');
    setLines(barEntryItems(app.state, entry.id).map((item) => ({ id: lineId(), productId: item.product_id, selectedSuggestion: item.product_id ?? item.product_name, name: item.product_name, quantity: String(item.quantity).replace('.', ','), unitPrice: Number(item.unit_price).toFixed(2).replace('.', ',') })));
    setFormError(''); setEntryOpen(true);
  };
  const closeEntry = () => { if (!busy) { setEntryOpen(false); resetEntry(); } };
  const selectDebtor = (id?: string) => {
    setDebtorId(id);
    const debtor = app.state.barDebtors.find((value) => value.id === id);
    setDebtorName(debtor?.name ?? ''); setDebtorContact(debtor?.contact ?? '');
  };
  const changeDebtorName = (value: string) => {
    setDebtorName(value);
    if (debtorId) { setDebtorId(undefined); setDebtorContact(''); }
  };
  const changeLine = (id: string, values: Partial<FormLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...values } : line));
  const chooseProduct = (id: string, product: BarProductSuggestion) => changeLine(id, { productId: product.productId, selectedSuggestion: product.key, name: product.name, unitPrice: Number(product.unitPrice).toFixed(2).replace('.', ',') });
  const formTotal = roundMoney(lines.reduce((sum, line) => sum + (Number.isFinite(numberValue(line.quantity)) && Number.isFinite(numberValue(line.unitPrice)) ? numberValue(line.quantity) * numberValue(line.unitPrice) : 0), 0));

  const submitEntry = async () => {
    const parsedDate = parseLocalDate(occurredAt);
    if (!debtorName.trim()) { setFormError('Sisesta inimese nimi.'); return; }
    if (!parsedDate) { setFormError('Kasuta kuupäeva kujul AAAA-KK-PP HH:MM.'); return; }
    const items = lines.map((line) => ({ product_id: line.productId, product_name: line.name.trim(), quantity: numberValue(line.quantity), unit_price: numberValue(line.unitPrice) }));
    if (items.some((item) => !item.product_name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price <= 0)) { setFormError('Kontrolli kõigi toodete nime, kogust ja hinda.'); return; }
    setBusy(true); setFormError('');
    try {
      const input = { debtor_id: debtorId, debtor_name: debtorName.trim(), debtor_contact: debtorContact.trim() || undefined, occurred_at: parsedDate, note: entryNote.trim() || undefined, payment_method: entryPaymentMethod, items };
      if (editingId) await app.updateBarLedgerEntry(editingId, input); else await app.createBarLedgerEntry(input);
      setEntryOpen(false); resetEntry();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Kirje salvestamine ebaõnnestus.'); }
    finally { setBusy(false); }
  };

  const openPayment = (entry: BarLedgerEntry) => {
    setPaymentEntryId(entry.id); setPaymentAmount(barEntryRemaining(app.state, entry).toFixed(2).replace('.', ',')); setPaymentDate(localDateValue()); setPaymentNote(''); setFormError('');
  };
  const closePayment = () => { if (!busy) { setPaymentEntryId(null); setFormError(''); } };
  const submitPayment = async () => {
    const amount = numberValue(paymentAmount); const paidAt = parseLocalDate(paymentDate);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Sisesta nullist suurem makse.'); return; }
    if (!paidAt) { setFormError('Kasuta kuupäeva kujul AAAA-KK-PP HH:MM.'); return; }
    setBusy(true); setFormError('');
    try { await app.recordBarLedgerPayment(paymentEntryId!, { amount, paid_at: paidAt, note: paymentNote.trim() || undefined }); setPaymentEntryId(null); }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Makse salvestamine ebaõnnestus.'); }
    finally { setBusy(false); }
  };

  const selectCreditDebtor = (id?: string) => {
    setCreditDebtorId(id);
    const debtor = app.state.barDebtors.find((value) => value.id === id);
    setCreditName(debtor?.name ?? ''); setCreditContact(debtor?.contact ?? '');
  };
  const changeCreditName = (value: string) => {
    setCreditName(value);
    if (creditDebtorId) { setCreditDebtorId(undefined); setCreditContact(''); }
  };
  const openCredit = (debtorId?: string) => {
    const debtor = app.state.barDebtors.find((value) => value.id === debtorId);
    setCreditOwnerId(debtor?.owner_id ?? ledgerUserId); setCreditDebtorId(debtor?.id); setCreditName(debtor?.name ?? ''); setCreditContact(debtor?.contact ?? '');
    setCreditAmount(''); setCreditDate(localDateValue()); setCreditNote(''); setCreditPaymentMethod('cash'); setFormError(''); setCreditOpen(true);
  };
  const closeCredit = () => { if (!busy) { setCreditOpen(false); setFormError(''); } };
  const submitCredit = async () => {
    const amount = numberValue(creditAmount); const occurredAt = parseLocalDate(creditDate);
    if (!creditName.trim()) { setFormError('Sisesta inimese nimi.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Sisesta nullist suurem ettemakse.'); return; }
    if (!occurredAt) { setFormError('Kasuta kuupäeva kujul AAAA-KK-PP HH:MM.'); return; }
    setBusy(true); setFormError('');
    try {
      await app.recordBarPrepayment({ owner_id: creditOwnerId, debtor_id: creditDebtorId, debtor_name: creditName.trim(), debtor_contact: creditContact.trim() || undefined, amount, occurred_at: occurredAt, note: creditNote.trim() || undefined, payment_method: creditPaymentMethod });
      setCreditOpen(false);
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Ettemakse salvestamine ebaõnnestus.'); }
    finally { setBusy(false); }
  };
  const voidCredit = (transactionId: string) => ask('Tühista ettemakse?', 'Ettemakse jääb ajalukku, kuid eemaldatakse inimese saldost.', () => {
    setBusy(true); void app.voidBarPrepayment(transactionId).catch((reason) => showMessage(reason instanceof Error ? reason.message : 'Ettemakse tühistamine ebaõnnestus.')).finally(() => setBusy(false));
  });

  const openProduct = (product?: BarProduct) => { setProductId(product?.id); setProductName(product?.name ?? ''); setProductPrice(product ? Number(product.unit_price).toFixed(2).replace('.', ',') : ''); setFormError(''); setProductOpen(true); };
  const closeProduct = () => { if (!busy) { setProductOpen(false); setFormError(''); } };
  const submitProduct = async () => {
    const unitPrice = numberValue(productPrice);
    if (!productName.trim() || !Number.isFinite(unitPrice) || unitPrice <= 0) { setFormError('Sisesta toote nimi ja nullist suurem hind.'); return; }
    setBusy(true); setFormError('');
    try { await app.saveBarProduct({ id: productId, name: productName.trim(), unit_price: unitPrice, active: true }); setProductOpen(false); }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Toote salvestamine ebaõnnestus.'); }
    finally { setBusy(false); }
  };
  const toggleProduct = async (product: BarProduct) => {
    setBusy(true);
    try { await app.saveBarProduct({ id: product.id, name: product.name, unit_price: Number(product.unit_price), active: !product.active }); }
    catch (reason) { showMessage(reason instanceof Error ? reason.message : 'Toote muutmine ebaõnnestus.'); }
    finally { setBusy(false); }
  };

  const cancelEntry = (entry: BarLedgerEntry) => ask('Tühista vihikukirje?', 'Kirje ja maksete ajalugu säilivad, kuid kriips eemaldatakse aktiivsete alt.', () => {
    setBusy(true); void app.cancelBarLedgerEntry(entry.id).catch((reason) => showMessage(reason instanceof Error ? reason.message : 'Tühistamine ebaõnnestus.')).finally(() => setBusy(false));
  });
  const voidPayment = (paymentId: string) => ask('Tühista makse?', 'Makse jääb ajalukku ning selle summa lisatakse kriipsujäägile tagasi.', () => {
    setBusy(true); void app.voidBarLedgerPayment(paymentId).catch((reason) => showMessage(reason instanceof Error ? reason.message : 'Makse tühistamine ebaõnnestus.')).finally(() => setBusy(false));
  });

  const paymentMethodPicker = (value: BarPaymentMethod, onChange: (method: BarPaymentMethod) => void) => <View style={styles.paymentMethodField}>
    <Text style={styles.filterLabel}>Makseviis</Text>
    <View accessibilityRole="radiogroup" style={styles.paymentMethodChoices}>{paymentMethods.map((method) => <Pressable key={method.value} accessibilityRole="radio" accessibilityState={{ selected: value === method.value }} onPress={() => onChange(method.value)} style={({ pressed }) => [styles.paymentMethodChoice, value === method.value && styles.paymentMethodChoiceActive, pressed && styles.suggestionPressed]}><Text style={[styles.paymentMethodChoiceText, value === method.value && styles.paymentMethodChoiceTextActive]}>{method.label}</Text></Pressable>)}</View>
  </View>;

  const creditDetails = (debtor: (typeof app.state.barDebtors)[number]) => {
    const transactions = app.state.barCreditTransactions.filter((transaction) => transaction.debtor_id === debtor.id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return <View key={`credit-${debtor.id}`} style={styles.creditDetails}>
      {transactions.length ? <View style={styles.paymentList}><Text style={styles.subheading}>Ettemakse ajalugu</Text>{transactions.slice(0, 8).map((transaction) => { const recorder = app.state.profiles.find((profile) => profile.id === transaction.recorded_by)?.display_name ?? 'Kasutaja'; const isDeposit = transaction.kind === 'deposit'; const methodLabel = isDeposit ? barPaymentMethodLabel(transaction.payment_method) : ''; return <View key={transaction.id} style={styles.paymentRow}><View style={{ flex: 1 }}><Text style={[styles.paymentAmount, transaction.voided_at && styles.voided]}>{isDeposit ? '+' : '−'}{formatBarEuros(transaction.amount)}{methodLabel ? ` · ${methodLabel}` : ''}{transaction.voided_at ? ' · tühistatud' : transaction.kind === 'usage' ? ' · kasutatud ostuks' : ''}</Text><Text style={styles.smallMeta}>{new Date(transaction.occurred_at).toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })} · registreeris {recorder}{transaction.note ? ` · ${transaction.note}` : ''}</Text></View>{isDeposit && !transaction.voided_at ? <Button label="Tühista" variant="ghost" disabled={busy} onPress={() => voidCredit(transaction.id)} /> : null}</View>; })}</View> : null}
      <Button label="Lisa ettemakse" icon="+" variant="secondary" disabled={busy} onPress={() => openCredit(debtor.id)} />
    </View>;
  };

  const entryCard = (entry: BarLedgerEntry, compact = false) => {
    const debtor = app.state.barDebtors.find((value) => value.id === entry.debtor_id);
    const items = barEntryItems(app.state, entry.id);
    const payments = app.state.barLedgerPayments.filter((payment) => payment.entry_id === entry.id).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    const paid = barEntryPaid(app.state, entry.id); const remaining = barEntryRemaining(app.state, entry);
    const events = app.state.barLedgerEvents.filter((value) => value.entry_id === entry.id).slice(0, 8);
    return <Card key={entry.id} style={compact ? styles.entryDetailCard : undefined}>
      <View style={styles.cardTop}><View style={{ flex: 1, minWidth: 180 }}><Text style={compact ? styles.entryDate : styles.debtorName}>{compact ? new Date(entry.occurred_at).toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' }) : debtor?.name ?? 'Nimetu'}</Text>{!compact ? <Text style={styles.meta}>{new Date(entry.occurred_at).toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}{!compact && debtor?.contact ? <Text style={styles.contact}>{debtor.contact}</Text> : null}</View><View style={styles.amountBox}><Text style={styles.amountLabel}>{entry.status === 'open' ? 'Jääk' : entry.status === 'paid' ? 'Tasutud' : 'Tühistatud'}</Text><Text style={styles.amount}>{formatBarEuros(entry.status === 'open' ? remaining : entry.total_amount)}</Text></View></View>
      <View style={styles.itemList}>{items.map((item) => <View key={item.id} style={styles.itemRow}><Text style={styles.itemName}>{item.product_name}</Text><Text style={styles.itemMath}>{Number(item.quantity).toLocaleString('et-EE')} × {formatBarEuros(item.unit_price)}</Text><Text style={styles.itemTotal}>{formatBarEuros(item.line_total)}</Text></View>)}</View>
      {entry.payment_method ? <Text style={styles.paymentMethodBadge}>{barPaymentMethodLabel(entry.payment_method)}</Text> : null}
      <View style={styles.totalRow}><Text style={styles.totalLabel}>Kokku {formatBarEuros(entry.total_amount)}</Text>{paid > 0 ? <Text style={styles.paidLabel}>Makstud {formatBarEuros(paid)}</Text> : null}</View>
      {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
      {payments.length ? <View style={styles.paymentList}><Text style={styles.subheading}>Maksed</Text>{payments.map((payment) => { const recorder = app.state.profiles.find((profile) => profile.id === payment.recorded_by)?.display_name ?? 'Kasutaja'; const voider = app.state.profiles.find((profile) => profile.id === payment.voided_by)?.display_name; return <View key={payment.id} style={styles.paymentRow}><View style={{ flex: 1 }}><Text style={[styles.paymentAmount, payment.voided_at && styles.voided]}>{formatBarEuros(payment.amount)}{payment.source === 'prepayment' ? ' · ettemaksest' : ''}{payment.voided_at ? ' · tühistatud' : ''}</Text><Text style={styles.smallMeta}>{new Date(payment.paid_at).toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'short' })} · registreeris {recorder}{payment.note ? ` · ${payment.note}` : ''}{voider ? ` · tühistas ${voider}` : ''}</Text></View>{!payment.voided_at ? <Button label="Tühista" variant="ghost" disabled={busy} onPress={() => voidPayment(payment.id)} /> : null}</View>; })}</View> : null}
      {events.length ? <View style={styles.audit}><Text style={styles.subheading}>Muudatuste ajalugu</Text>{events.map((item) => { const actor = app.state.profiles.find((profile) => profile.id === item.actor_id)?.display_name ?? 'Kasutaja'; return <Text key={item.id} style={styles.smallMeta}>{item.event_type === 'updated' ? 'Kirjet parandati' : item.event_type === 'payment_added' ? 'Makse lisati' : item.event_type === 'payment_voided' ? 'Makse tühistati' : item.event_type === 'cancelled' ? 'Kirje tühistati' : 'Kirje loodi'} · {actor} · {new Date(item.created_at).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' })}</Text>; })}</View> : null}
      {entry.status === 'open' ? <Button label="Tasutud" icon="€" disabled={busy} onPress={() => openPayment(entry)} /> : null}
      {entry.status !== 'cancelled' ? <View style={styles.actions}><View style={styles.action}><Button label="Paranda" icon="✎" variant="secondary" disabled={busy} onPress={() => openEdit(entry)} /></View><View style={styles.action}><Button label="Tühista kirje" variant="danger" disabled={busy} onPress={() => cancelEntry(entry)} /></View></View> : null}
    </Card>;
  };

  const personCard = ({ debtor, entries, credit }: (typeof debtorGroups)[number]) => {
    const expanded = Boolean(expandedDebtors[debtor.id]);
    const debtTotal = roundMoney(entries.reduce((sum, entry) => sum + (mode === 'active' ? barEntryRemaining(app.state, entry) : Number(entry.total_amount)), 0));
    const entryLabel = entries.length === 1 ? '1 kirje' : `${entries.length} kirjet`;
    const activeEntryLabel = entries.length === 1 ? '1 aktiivne kirje' : `${entries.length} aktiivset kirjet`;
    const detailsId = `debtor-${debtor.id}-details`;
    return <Card key={debtor.id}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${debtor.name}, ${entryLabel}. ${expanded ? 'Peida kirjed' : 'Näita kirjeid'}`} onPress={() => setExpandedDebtors((current) => ({ ...current, [debtor.id]: !expanded }))} style={styles.personHeader}>
        <View style={styles.personIdentity}><Text style={styles.debtorName}>{debtor.name}</Text><Text style={styles.meta}>{mode === 'active' ? (entries.length ? activeEntryLabel : 'Aktiivseid kriipse pole') : `${entryLabel} ajaloos`}</Text>{debtor.contact ? <Text style={styles.contact}>{debtor.contact}</Text> : null}</View>
        <View style={styles.personBalances}>{entries.length ? <View style={styles.amountBox}>{mode === 'history' ? <Text style={styles.amountLabel}>Kirjete summa</Text> : null}<Text style={styles.amount}>{formatBarEuros(debtTotal)}</Text></View> : null}{mode === 'active' && credit > 0 ? <View style={[styles.amountBox, styles.creditAmountBox]}><Text style={styles.amountLabel}>Ettemakse</Text><Text style={styles.creditAmount}>{formatBarEuros(credit)}</Text></View> : null}<Text style={styles.expandArrow}>{expanded ? '⌃' : '⌄'}</Text></View>
      </Pressable>
      {expanded ? <View nativeID={detailsId} style={styles.personDetails}>{mode === 'active' ? creditDetails(debtor) : null}{entries.map((entry) => entryCard(entry, true))}</View> : null}
    </Card>;
  };

  return <Page title={isOwnLedger ? 'Baarivihik' : `${selectedLedgerName} · Baarivihik`} subtitle="Väliste inimeste kriipsude ja ettemaksete haldamine." action={mode === 'products' ? <Button label="Lisa toode" icon="+" onPress={() => openProduct()} /> : isOwnLedger ? <Button label="Lisa kriips" icon="+" onPress={openNew} /> : null}>
    {app.isAdmin && mode !== 'products' ? <View style={styles.adminActions}><View style={styles.adminAction}><Button label={isOwnLedger ? 'Vaata teist vihikut' : 'Vaheta vihikut'} variant="secondary" onPress={() => setLedgerPickerOpen(true)} /></View>{!isOwnLedger ? <View style={styles.adminAction}><Button label="Minu vihik" variant="ghost" onPress={() => { setLedgerUserId(userId); setExpandedDebtors({}); }} /></View> : null}</View> : null}
    {mode !== 'products' ? <Button label="Lisa ettemakse" icon="+" variant="secondary" onPress={() => openCredit()} /> : null}
    <Card style={styles.summary}><View style={styles.summaryStat}><Text style={styles.summaryLabel}>Aktiivsed kriipsud</Text><Text style={styles.summaryValue}>{formatBarEuros(activeTotal)}</Text></View><View style={styles.summaryStat}><Text style={styles.summaryLabel}>Ettemakseid</Text><Text style={styles.summaryValue}>{formatBarEuros(totalCredit)}</Text></View><View style={styles.summaryStat}><Text style={styles.summaryLabel}>Inimesi</Text><Text style={styles.summaryValue}>{activeDebtors}</Text></View><View style={styles.summaryStat}><Text style={styles.summaryLabel}>Kirjeid</Text><Text style={styles.summaryValue}>{activeEntries.length}</Text></View></Card>
    <View style={styles.tabs}>{([['active', 'Aktiivsed'], ['history', 'Ajalugu'], ['products', 'Tooted']] as [ViewMode, string][]).map(([value, label]) => <Pressable key={value} onPress={() => setMode(value)} style={[styles.tab, mode === value && styles.tabActive]}><Text style={[styles.tabText, mode === value && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
    {mode !== 'products' ? <>
      <Field label="Otsi nime või märkuse järgi" value={query} onChangeText={setQuery} placeholder="Alusta kirjutamist…" />
      {debtorGroups.length ? debtorGroups.map(personCard) : <Empty icon="€" title={mode === 'active' ? 'Aktiivseid kriipse ega ettemakseid pole' : 'Ajalugu on tühi'} body={mode === 'active' ? 'Lisa esimene baarist võetud kaup või ettemakse.' : 'Tasutud ja tühistatud kirjed ilmuvad siia.'} />}
    </> : <>
      <Text style={styles.sectionIntro}>Grupi ühine hinnakiri. Vihikukirjesse salvestub alati selle hetke hind.</Text>
      {app.state.barProducts.length ? [...app.state.barProducts].sort((a, b) => a.name.localeCompare(b.name, 'et')).map((product) => {
        const canEdit = product.created_by === userId || app.isAdmin;
        return <Card key={product.id} style={!product.active ? styles.inactiveCard : undefined}><View style={styles.productRow}><View style={{ flex: 1 }}><Text style={styles.productName}>{product.name}</Text><Text style={styles.meta}>{formatBarEuros(product.unit_price)}{!product.active ? ' · peidetud' : ''}</Text></View>{canEdit ? <View style={styles.productActions}><Button label="Muuda" variant="secondary" disabled={busy} onPress={() => openProduct(product)} /><Button label={product.active ? 'Peida' : 'Taasta'} variant="ghost" disabled={busy} onPress={() => void toggleProduct(product)} /></View> : null}</View></Card>;
      }) : <Empty icon="€" title="Tooteid pole" body="Lisa sagedamini kasutatavad baaritooted ja nende hinnad." />}
    </>}

    <Sheet visible={entryOpen} title={editingId ? 'Paranda vihikukirjet' : 'Uus kriips'} onClose={closeEntry}>
      <Field label="Inimese nimi" value={debtorName} onChangeText={changeDebtorName} placeholder="Näiteks Jaan Tamm" maxLength={120} autoFocus={!editingId} />
      {!debtorId && matchingDebtors.length ? <View style={styles.suggestions}><Text style={styles.suggestionLabel}>Varasemad nimed</Text>{matchingDebtors.map((debtor) => <Pressable key={debtor.id} accessibilityRole="button" accessibilityLabel={`Vali ${debtor.name}`} onPress={() => selectDebtor(debtor.id)} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}><View style={{ flex: 1 }}><Text style={styles.suggestionTitle}>{debtor.name}</Text>{debtor.contact ? <Text style={styles.suggestionMeta}>{debtor.contact}</Text> : null}</View><Text style={styles.suggestionAction}>Vali</Text></Pressable>)}</View> : null}
      <Field label="Telefon või märkus (valikuline)" value={debtorContact} onChangeText={setDebtorContact} placeholder="Näiteks +372 … või kajut 4201" maxLength={240} />
      <Field label="Kuupäev ja kellaaeg" value={occurredAt} onChangeText={setOccurredAt} placeholder="AAAA-KK-PP HH:MM" autoCapitalize="none" />
      {paymentMethodPicker(entryPaymentMethod, setEntryPaymentMethod)}
      <Field label="Üldine märkus (valikuline)" value={entryNote} onChangeText={setEntryNote} placeholder="Lisainfo selle ostu kohta" maxLength={500} />
      <Text style={styles.formHeading}>Tooted</Text>
      {lines.map((line, index) => {
        const matchingProducts = line.selectedSuggestion ? [] : barProductSuggestions(app.state, formOwnerId, line.name);
        return <Card key={line.id} style={styles.lineCard}>
        <Text style={styles.lineTitle}>Toode {index + 1}</Text>
        <Field label="Toote nimi" value={line.name} onChangeText={(value) => changeLine(line.id, { name: value, productId: undefined, selectedSuggestion: undefined })} placeholder="Toote nimi" maxLength={120} />
        {matchingProducts.length ? <View style={styles.suggestions}><Text style={styles.suggestionLabel}>Varasemad tooted</Text>{matchingProducts.map((product) => <Pressable key={product.key} accessibilityRole="button" accessibilityLabel={`Vali ${product.name}, ${formatBarEuros(product.unitPrice)}`} onPress={() => chooseProduct(line.id, product)} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}><Text style={styles.suggestionTitle}>{product.name}</Text><Text style={styles.suggestionMeta}>{formatBarEuros(product.unitPrice)}</Text></Pressable>)}</View> : null}
        <View style={styles.twoFields}><View style={styles.fieldHalf}><Field label="Kogus" value={line.quantity} onChangeText={(value) => changeLine(line.id, { quantity: value })} keyboardType="decimal-pad" inputMode="decimal" placeholder="1" /></View><View style={styles.fieldHalf}><Field label="Ühiku hind €" value={line.unitPrice} onChangeText={(value) => changeLine(line.id, { unitPrice: value, productId: undefined })} keyboardType="decimal-pad" inputMode="decimal" placeholder="0,00" /></View></View>
        <Text style={styles.lineSum}>Rea summa: {formatBarEuros(roundMoney(Math.max(0, numberValue(line.quantity) * numberValue(line.unitPrice) || 0)))}</Text>
        {lines.length > 1 ? <Button label="Eemalda rida" variant="ghost" onPress={() => setLines((current) => current.filter((value) => value.id !== line.id))} /> : null}
      </Card>; })}
      <Button label="Lisa tooterida" icon="+" variant="secondary" onPress={() => setLines((current) => [...current, emptyLine()])} />
      <View style={styles.formTotal}><Text style={styles.formTotalLabel}>Kogusumma</Text><Text style={styles.formTotalValue}>{formatBarEuros(formTotal)}</Text></View>
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <Button label={busy ? 'Salvestan…' : editingId ? 'Salvesta parandused' : 'Lisa vihikusse'} disabled={busy} onPress={() => void submitEntry()} />
    </Sheet>

    <Sheet visible={Boolean(paymentEntryId)} title="Tasutud" onClose={closePayment}>
      {paymentEntry ? <Card style={styles.paymentSummary}><Text style={styles.summaryLabel}>Tasumata jääk</Text><Text style={styles.summaryValue}>{formatBarEuros(barEntryRemaining(app.state, paymentEntry))}</Text></Card> : null}
      <Field label="Makstud summa €" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="0,00" autoFocus />
      <Field label="Makse kuupäev ja kellaaeg" value={paymentDate} onChangeText={setPaymentDate} placeholder="AAAA-KK-PP HH:MM" autoCapitalize="none" />
      <Field label="Märkus (valikuline)" value={paymentNote} onChangeText={setPaymentNote} placeholder="Näiteks sularahas" maxLength={500} />
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <Button label={busy ? 'Salvestan…' : 'Kinnita tasumine'} disabled={busy} onPress={() => void submitPayment()} />
    </Sheet>

    <Sheet visible={ledgerPickerOpen} title="Vali vihik" onClose={() => setLedgerPickerOpen(false)}>
      <Text style={styles.sectionIntro}>Vali Saarly kasutaja, kelle Baarivihikut soovid administraatorina vaadata.</Text>
      <View style={styles.ledgerChoices}>{owners.map((owner) => <Button key={owner.id} label={owner.id === userId ? 'Minu vihik' : owner.display_name} variant={owner.id === ledgerUserId ? 'secondary' : 'ghost'} onPress={() => { setLedgerUserId(owner.id); setLedgerPickerOpen(false); setExpandedDebtors({}); setQuery(''); }} />)}</View>
    </Sheet>

    <Sheet visible={creditOpen} title="Lisa ettemakse" onClose={closeCredit}>
      <Field label="Inimese nimi" value={creditName} onChangeText={changeCreditName} placeholder="Näiteks Heino" maxLength={120} autoFocus />
      {!creditDebtorId && matchingCreditDebtors.length ? <View style={styles.suggestions}><Text style={styles.suggestionLabel}>Varasemad nimed</Text>{matchingCreditDebtors.map((debtor) => <Pressable key={debtor.id} accessibilityRole="button" accessibilityLabel={`Vali ${debtor.name}`} onPress={() => selectCreditDebtor(debtor.id)} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}><View style={{ flex: 1 }}><Text style={styles.suggestionTitle}>{debtor.name}</Text>{debtor.contact ? <Text style={styles.suggestionMeta}>{debtor.contact}</Text> : null}</View><Text style={styles.suggestionAction}>Vali</Text></Pressable>)}</View> : null}
      <Field label="Telefon või märkus (valikuline)" value={creditContact} onChangeText={setCreditContact} placeholder="Näiteks +372 … või kajut 4201" maxLength={240} />
      <Field label="Ettemakse summa €" value={creditAmount} onChangeText={setCreditAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="0,00" />
      <Field label="Kuupäev ja kellaaeg" value={creditDate} onChangeText={setCreditDate} placeholder="AAAA-KK-PP HH:MM" autoCapitalize="none" />
      {paymentMethodPicker(creditPaymentMethod, setCreditPaymentMethod)}
      <Field label="Märkus (valikuline)" value={creditNote} onChangeText={setCreditNote} placeholder="Näiteks sularahas" maxLength={500} />
      <Text style={styles.sectionIntro}>Ettemakse tasub esmalt selle inimese olemasolevad kriipsud. Ülejääk jääb järgmiste ostude jaoks saldole.</Text>
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <Button label={busy ? 'Salvestan…' : 'Salvesta ettemakse'} disabled={busy} onPress={() => void submitCredit()} />
    </Sheet>

    <Sheet visible={productOpen} title={productId ? 'Muuda toodet' : 'Uus baaritoode'} onClose={closeProduct}>
      <Field label="Toote nimi" value={productName} onChangeText={setProductName} placeholder="Näiteks Coca-Cola" maxLength={120} autoFocus />
      <Field label="Ühiku hind €" value={productPrice} onChangeText={setProductPrice} keyboardType="decimal-pad" inputMode="decimal" placeholder="0,00" />
      <Text style={styles.sectionIntro}>Hinna muutmine mõjutab ainult uusi vihikukirjeid.</Text>
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <Button label={busy ? 'Salvestan…' : 'Salvesta toode'} disabled={busy} onPress={() => void submitProduct()} />
    </Sheet>
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, summaryStat: { flexGrow: 1, flexBasis: 140, minWidth: 0, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13 }, summaryLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' }, summaryValue: { color: colors.ink, fontSize: 23, fontWeight: '700', marginTop: 4 },
  adminActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, adminAction: { flexGrow: 1, minWidth: 150 }, ledgerChoices: { gap: 8 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 11, padding: 4, gap: 4 }, tab: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, tabActive: { backgroundColor: colors.primarySoft }, tabText: { color: colors.muted, fontSize: 15, fontWeight: '700' }, tabTextActive: { color: colors.primaryDark },
  filterLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' }, paymentMethodField: { gap: 7 }, paymentMethodChoices: { flexDirection: 'row', gap: 8 }, paymentMethodChoice: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: 9, backgroundColor: colors.field, paddingHorizontal: 12, paddingVertical: 10 }, paymentMethodChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, paymentMethodChoiceText: { color: colors.ink, fontSize: 15, fontWeight: '700' }, paymentMethodChoiceTextActive: { color: colors.primaryDark }, paymentMethodBadge: { alignSelf: 'flex-start', color: colors.primaryDark, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, fontSize: 13, fontWeight: '700' },
  suggestions: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface }, suggestionLabel: { color: colors.muted, backgroundColor: colors.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, suggestion: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }, suggestionPressed: { backgroundColor: colors.primarySoft }, suggestionTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' }, suggestionMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 }, suggestionAction: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  personHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', minHeight: 58 }, personIdentity: { flex: 1, minWidth: 170 }, personBalances: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }, expandArrow: { color: colors.primaryDark, fontSize: 28, lineHeight: 32, fontWeight: '700', width: 30, textAlign: 'center' }, personDetails: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }, creditDetails: { gap: 12 }, entryDetailCard: { backgroundColor: colors.subtle }, entryDate: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }, debtorName: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }, contact: { color: colors.primaryDark, fontSize: 15, lineHeight: 21, marginTop: 4 }, amountBox: { alignItems: 'flex-end', backgroundColor: colors.subtle, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, creditAmountBox: { backgroundColor: colors.primarySoft }, amountLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, amount: { color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 2 }, creditAmount: { color: colors.primaryDark, fontSize: 21, fontWeight: '800', marginTop: 2 },
  itemList: { borderTopWidth: 1, borderTopColor: colors.border }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }, itemName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' }, itemMath: { color: colors.muted, fontSize: 13 }, itemTotal: { color: colors.ink, fontSize: 15, fontWeight: '700' }, totalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '700' }, paidLabel: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' }, note: { color: colors.ink, fontSize: 15, lineHeight: 22, backgroundColor: colors.subtle, padding: 11, borderRadius: 8 },
  paymentList: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }, paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, paymentAmount: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' }, voided: { color: colors.muted, textDecorationLine: 'line-through' }, smallMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 }, subheading: { color: colors.ink, fontSize: 15, fontWeight: '700' }, audit: { gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actions: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' }, action: { flexGrow: 1, minWidth: 135 }, sectionIntro: { color: colors.muted, fontSize: 15, lineHeight: 22 }, productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, productName: { color: colors.ink, fontSize: 18, fontWeight: '700' }, productActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, inactiveCard: { opacity: .67 },
  formHeading: { color: colors.ink, fontSize: 19, fontWeight: '700', marginTop: 3 }, lineCard: { backgroundColor: colors.subtle, padding: 14 }, lineTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' }, twoFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, fieldHalf: { flexGrow: 1, flexBasis: 150 }, lineSum: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' }, formTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 10, padding: 14 }, formTotalLabel: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' }, formTotalValue: { color: colors.primaryDark, fontSize: 22, fontWeight: '800' }, error: { color: colors.danger, fontSize: 15, lineHeight: 21 }, paymentSummary: { backgroundColor: colors.primarySoft },
});
