import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SUBJECTS, subjectById } from "./subjects";

// Адрес бэкенда. На телефоне localhost не работает — нужен IP компьютера в той же Wi-Fi сети.
const API = "https://remained-anthony-isaac-newark.trycloudflare.com";

const light = {
  bg: "#f4f3ef", surface: "#ffffff", raised: "#ffffff", text: "#1b1a18", muted: "#75716a",
  faint: "#ebe9e3", border: "#e2dfd7", accent: "#3b5bdb", accentText: "#ffffff",
  danger: "#d9480f", dangerBg: "#fff0e6", warn: "#e67700", warnBg: "#fff6db",
};
const dark = {
  bg: "#121211", surface: "#1c1b19", raised: "#242320", text: "#efeee9", muted: "#9e9a91",
  faint: "#2a2926", border: "#34322e", accent: "#7d94ff", accentText: "#0d0d0c",
  danger: "#ff8a5c", dangerBg: "#3a2219", warn: "#ffc34d", warnBg: "#352b14",
};

// ---------- даты ----------
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOnly = (s) => s.slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toKey(d); };
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const daysUntil = (k) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((parseKey(k) - t) / 86400000);
};
const fmtLong = (k) => parseKey(k).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = (k) => parseKey(k).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
  return c;
};
const days = (n) => `${n} ${plural(n, "день", "дня", "дней")}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function sectionTitle(k) {
  const d = daysUntil(k);
  if (d < 0) return "Просрочено";
  if (d === 0) return "Сегодня";
  if (d === 1) return "Завтра";
  if (d < 7) return cap(parseKey(k).toLocaleDateString("ru-RU", { weekday: "long" }));
  return cap(fmtLong(k));
}

function duePill(k) {
  const d = daysUntil(k);
  if (d < 0) return { text: `−${days(-d)}`, tone: "danger" };
  if (d === 0) return { text: "сегодня", tone: "warn" };
  if (d === 1) return { text: "завтра", tone: "warn" };
  return { text: fmtShort(k), tone: "muted" };
}

// ---------- API ----------
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `Ошибка ${res.status}`);
    e.data = data;
    throw e;
  }
  return data;
}
const netMsg = (e) => (e.message === "Network request failed" ? "Нет связи с сервером" : e.message);

// ---------- приложение ----------
export default function App() {
  const c = useColorScheme() === "dark" ? dark : light;
  const s = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("upcoming");
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [editing, setEditing] = useState(null); // null — закрыто, {} — новая, {id,...} — правка

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api("GET", "/homeworks"));
    } catch (e) {
      setError(netMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = toKey(new Date());
  const tomorrow = addDays(1);
  const stats = useMemo(() => ({
    overdue: items.filter((h) => dateOnly(h.due_date) < today).length,
    today: items.filter((h) => dateOnly(h.due_date) === today).length,
    tomorrow: items.filter((h) => dateOnly(h.due_date) === tomorrow).length,
    upcoming: items.filter((h) => dateOnly(h.due_date) >= today).length,
  }), [items, today, tomorrow]);

  const usedSubjects = useMemo(() => {
    const ids = new Set(items.map((h) => h.subject_id));
    return SUBJECTS.filter((x) => ids.has(x.id));
  }, [items]);

  const sections = useMemo(() => {
    let list = items;
    if (subjectFilter) list = list.filter((h) => h.subject_id === subjectFilter);
    if (filter === "upcoming") list = list.filter((h) => dateOnly(h.due_date) >= today);
    if (filter === "past") list = list.filter((h) => dateOnly(h.due_date) < today).slice().reverse();
    const map = new Map();
    for (const h of list) {
      const k = dateOnly(h.due_date);
      const key = filter !== "past" && k < today ? "overdue" : k;
      if (!map.has(key)) map.set(key, { key, date: k, data: [] });
      map.get(key).data.push(h);
    }
    return [...map.values()].map((g) => ({
      ...g,
      title: g.key === "overdue" ? "Просрочено" : sectionTitle(g.date),
      overdue: g.key === "overdue" || daysUntil(g.date) < 0,
    }));
  }, [items, filter, subjectFilter, today]);

  const header = (
    <View>
      <View style={s.header}>
        <Text style={s.date}>{cap(fmtLong(today))}</Text>
        <Text style={s.h1}>Домашки</Text>
      </View>

      {!loading && !error && (
        <View style={s.stats}>
          <Stat s={s} value={stats.today} label="на сегодня" tone={stats.today ? c.warn : c.muted} />
          <Stat s={s} value={stats.tomorrow} label="на завтра" tone={c.text} />
          <Stat s={s} value={stats.overdue} label="просрочено" tone={stats.overdue ? c.danger : c.muted} />
        </View>
      )}

      <View style={s.segment}>
        {[["upcoming", `Впереди${stats.upcoming ? " · " + stats.upcoming : ""}`], ["all", "Все"], ["past", "Прошедшие"]].map(([k, label]) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[s.segItem, filter === k && s.segItemActive]}>
            <Text style={[s.segText, filter === k && s.segTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {usedSubjects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subjRow}>
          <Pressable onPress={() => setSubjectFilter(null)} style={[s.subjChip, !subjectFilter && { backgroundColor: c.text, borderColor: c.text }]}>
            <Text style={[s.subjChipText, !subjectFilter && { color: c.bg }]}>Все предметы</Text>
          </Pressable>
          {usedSubjects.map((x) => {
            const on = subjectFilter === x.id;
            return (
              <Pressable key={x.id} onPress={() => setSubjectFilter(on ? null : x.id)}
                style={[s.subjChip, on && { backgroundColor: x.color, borderColor: x.color }]}>
                <View style={[s.dot, { backgroundColor: on ? "#fff" : x.color }]} />
                <Text style={[s.subjChipText, on && { color: "#fff" }]}>{x.short}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle={c === dark ? "light-content" : "dark-content"} backgroundColor={c.bg} />

      {loading ? (
        <>{header}<ActivityIndicator style={{ marginTop: 60 }} color={c.muted} /></>
      ) : error ? (
        <>
          {header}
          <View style={s.center}>
            <Text style={s.emptyIcon}>⚠︎</Text>
            <Text style={[s.emptyTitle, { color: c.danger }]}>{error}</Text>
            <Text style={s.emptyText}>Проверь, что сервер запущен и телефон в той же Wi-Fi сети</Text>
            <Pressable style={[s.btn, { marginTop: 18 }]} onPress={() => { setLoading(true); load(); }}>
              <Text style={s.btnText}>Повторить</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(h) => String(h.id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.muted} />}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, section.overdue && { color: c.danger }]}>{section.title}</Text>
              <Text style={s.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => <Card hw={item} c={c} s={s} onPress={() => setEditing(item)} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyIcon}>{filter === "past" ? "🗂" : "🎉"}</Text>
              <Text style={s.emptyTitle}>{filter === "past" ? "Прошедших заданий нет" : "Всё сделано"}</Text>
              <Text style={s.emptyText}>Нажми «+», чтобы добавить домашку</Text>
            </View>
          }
        />
      )}

      <Pressable style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.94 }] }]} onPress={() => setEditing({})}>
        <Text style={s.fabText}>+</Text>
      </Pressable>

      <HomeworkForm
        hw={editing}
        c={c}
        s={s}
        lastSubject={items.length ? items[items.length - 1].subject_id : null}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function Stat({ s, value, label, tone }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color: tone }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Card({ hw, c, s, onPress }) {
  const subj = subjectById(hw.subject_id);
  const due = duePill(dateOnly(hw.due_date));
  const pillBg = due.tone === "danger" ? c.dangerBg : due.tone === "warn" ? c.warnBg : c.faint;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] }]}>
      <View style={[s.cardStripe, { backgroundColor: subj.color }]} />
      <View style={[s.icon, { backgroundColor: subj.color + "1f" }]}>
        <Text style={[s.iconText, { color: subj.color }]} numberOfLines={1}>{subj.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <Text style={[s.cardSubject, { color: subj.color }]} numberOfLines={1}>{subj.name}</Text>
          <View style={[s.pill, { backgroundColor: pillBg }]}>
            <Text style={[s.pillText, { color: c[due.tone] }]}>{due.text}</Text>
          </View>
        </View>
        <Text style={s.cardTitle}>{hw.title}</Text>
        {!!hw.description && <Text style={s.cardDesc} numberOfLines={2}>{hw.description}</Text>}
      </View>
    </Pressable>
  );
}

// ---------- форма ----------
function HomeworkForm({ hw, c, s, lastSubject, onClose, onSaved }) {
  const isEdit = !!(hw && hw.id);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(null);
  const [due, setDue] = useState("");
  const [desc, setDesc] = useState("");
  const [customDate, setCustomDate] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const dayStrip = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(i)), [hw]);

  useEffect(() => {
    if (!hw) return;
    const d = hw.due_date ? dateOnly(hw.due_date) : addDays(1);
    setTitle(hw.title || "");
    setSubject(hw.subject_id || lastSubject || null);
    setDue(d);
    setCustomDate(daysUntil(d) < 0 || daysUntil(d) > 20);
    setDesc(hw.description || "");
    setErrors({});
    setFormError(null);
  }, [hw]);

  async function save() {
    const local = {};
    if (!title.trim()) local.title = "Напиши, что задали";
    if (!subject) local.subject_id = "Выбери предмет";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) local.due_date = "Формат ГГГГ-ММ-ДД";
    if (Object.keys(local).length) { setErrors(local); return; }

    setSaving(true);
    setErrors({});
    setFormError(null);
    const body = { title, subject_id: subject, due_date: due, description: desc };
    try {
      if (isEdit) await api("PUT", `/homeworks/${hw.id}`, body);
      else await api("POST", "/homeworks", body);
      onSaved();
    } catch (e) {
      if (e.data && e.data.fields) setErrors(e.data.fields);
      else setFormError(netMsg(e));
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    Alert.alert("Удалить домашку?", `«${hw.title}»`, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить", style: "destructive",
        onPress: async () => {
          try { await api("DELETE", `/homeworks/${hw.id}`); onSaved(); }
          catch (e) { setFormError(netMsg(e)); }
        },
      },
    ]);
  }

  return (
    <Modal visible={!!hw} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.link}>Отмена</Text></Pressable>
          <Text style={s.sheetTitle}>{isEdit ? "Изменить" : "Новая домашка"}</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={12}>
            {saving ? <ActivityIndicator color={c.accent} /> : <Text style={[s.link, { fontWeight: "700" }]}>Готово</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {formError && <Text style={[s.formErr, { marginHorizontal: 20 }]}>{formError}</Text>}

          <Field label="Что задали" error={errors.title} s={s} pad>
            <TextInput style={[s.input, s.inputBig]} value={title} onChangeText={setTitle}
              placeholder="Например, № 143–144" placeholderTextColor={c.muted} />
          </Field>

          <Field label="Предмет" error={errors.subject_id} s={s} pad>
            <View style={s.subjGrid}>
              {SUBJECTS.map((x) => {
                const on = subject === x.id;
                return (
                  <Pressable key={x.id} onPress={() => setSubject(x.id)}
                    style={[s.subjOption, on && { borderColor: x.color, backgroundColor: x.color + "18" }]}>
                    <View style={[s.subjOptIcon, { backgroundColor: on ? x.color : x.color + "1f" }]}>
                      <Text style={[s.subjOptIconText, { color: on ? "#fff" : x.color }]} numberOfLines={1}>{x.icon}</Text>
                    </View>
                    <Text style={[s.subjOptText, on && { color: c.text, fontWeight: "600" }]} numberOfLines={2}>{x.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Сдать до" error={errors.due_date} s={s}>
            {!customDate ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {dayStrip.map((k, i) => {
                  const on = due === k;
                  const d = parseKey(k);
                  const weekend = d.getDay() === 0;
                  return (
                    <Pressable key={k} onPress={() => setDue(k)} style={[s.day, on && s.dayActive]}>
                      <Text style={[s.dayWeek, on && s.dayTextActive, weekend && !on && { color: c.danger }]}>
                        {i === 0 ? "сег" : i === 1 ? "завт" : WEEKDAYS[d.getDay()]}
                      </Text>
                      <Text style={[s.dayNum, on && s.dayTextActive]}>{d.getDate()}</Text>
                      <Text style={[s.dayMonth, on && s.dayTextActive]}>
                        {d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: 20 }}>
                <TextInput style={s.input} value={due} onChangeText={setDue}
                  placeholder="ГГГГ-ММ-ДД" placeholderTextColor={c.muted} keyboardType="numbers-and-punctuation" />
              </View>
            )}
            <Pressable onPress={() => setCustomDate(!customDate)} style={{ paddingHorizontal: 20, marginTop: 10 }} hitSlop={8}>
              <Text style={[s.link, { fontSize: 14 }]}>{customDate ? "Выбрать из ближайших дней" : "Другая дата…"}</Text>
            </Pressable>
          </Field>

          <Field label="Подробности" s={s} pad>
            <TextInput style={[s.input, { minHeight: 110, textAlignVertical: "top" }]} value={desc}
              onChangeText={setDesc} multiline placeholder="Страницы, условия, ссылки — необязательно" placeholderTextColor={c.muted} />
          </Field>

          {isEdit && (
            <Pressable style={[s.btn, { marginHorizontal: 20, marginTop: 4, backgroundColor: c.dangerBg, borderColor: "transparent" }]} onPress={remove}>
              <Text style={[s.btnText, { color: c.danger }]}>Удалить домашку</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, error, s, pad, children }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[s.label, { paddingHorizontal: 20 }]}>{label}</Text>
      <View style={pad ? { paddingHorizontal: 20 } : null}>{children}</View>
      {!!error && <Text style={[s.err, { paddingHorizontal: 20 }]}>{error}</Text>}
    </View>
  );
}

// ---------- стили ----------
function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
    header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
    date: { fontSize: 14, color: c.muted, fontWeight: "500" },
    h1: { fontSize: 34, fontWeight: "800", color: c.text, letterSpacing: -0.8, marginTop: 2 },

    stats: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 16 },
    stat: { flex: 1, backgroundColor: c.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
    statValue: { fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 12, color: c.muted, marginTop: 1 },

    segment: { flexDirection: "row", marginHorizontal: 16, backgroundColor: c.faint, borderRadius: 12, padding: 3 },
    segItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    segItemActive: { backgroundColor: c.raised, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
    segText: { fontSize: 14, color: c.muted, fontWeight: "500" },
    segTextActive: { color: c.text, fontWeight: "700" },

    subjRow: { paddingHorizontal: 16, gap: 8, paddingTop: 12 },
    subjChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
    subjChipText: { fontSize: 13, color: c.text, fontWeight: "500" },
    dot: { width: 8, height: 8, borderRadius: 4 },

    sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
    sectionTitle: { fontSize: 20, fontWeight: "700", color: c.text, letterSpacing: -0.3 },
    sectionCount: { fontSize: 14, color: c.muted, fontWeight: "600" },

    card: {
      flexDirection: "row", gap: 12, backgroundColor: c.surface, borderRadius: 18, overflow: "hidden",
      borderWidth: 1, borderColor: c.border, padding: 14, paddingLeft: 18, marginHorizontal: 16, marginBottom: 10,
    },
    cardStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
    icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    iconText: { fontSize: 17, fontWeight: "700" },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
    cardSubject: { flex: 1, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    pillText: { fontSize: 12, fontWeight: "700" },
    cardTitle: { fontSize: 16, fontWeight: "600", color: c.text, lineHeight: 21 },
    cardDesc: { fontSize: 14, color: c.muted, marginTop: 3, lineHeight: 19 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, marginTop: 30 },
    emptyIcon: { fontSize: 44, marginBottom: 10 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, textAlign: "center" },
    emptyText: { fontSize: 14, color: c.muted, marginTop: 4, textAlign: "center" },

    fab: {
      position: "absolute", right: 20, bottom: 36, width: 62, height: 62, borderRadius: 22,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
      shadowColor: c.accent, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    fabText: { color: c.accentText, fontSize: 34, lineHeight: 36, fontWeight: "300" },

    btn: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", backgroundColor: c.surface },
    btnText: { color: c.text, fontSize: 15, fontWeight: "600" },

    sheetHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 28 : 18, paddingBottom: 14,
      backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    sheetTitle: { fontSize: 17, fontWeight: "700", color: c.text },
    link: { color: c.accent, fontSize: 16 },

    label: { fontSize: 13, fontWeight: "700", color: c.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text, backgroundColor: c.surface },
    inputBig: { fontSize: 18, fontWeight: "600" },

    subjGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    subjOption: {
      width: "48.6%", flexDirection: "row", alignItems: "center", gap: 10, padding: 10, minHeight: 58,
      borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface,
    },
    subjOptIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    subjOptIconText: { fontSize: 14, fontWeight: "700" },
    subjOptText: { flex: 1, fontSize: 13, color: c.muted, lineHeight: 17 },

    day: { width: 58, paddingVertical: 10, borderRadius: 14, alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    dayActive: { backgroundColor: c.accent, borderColor: c.accent },
    dayWeek: { fontSize: 12, color: c.muted, fontWeight: "600" },
    dayNum: { fontSize: 20, color: c.text, fontWeight: "800", marginVertical: 1 },
    dayMonth: { fontSize: 11, color: c.muted },
    dayTextActive: { color: c.accentText },

    err: { color: c.danger, fontSize: 13, marginTop: 6 },
    formErr: { color: c.danger, fontSize: 14, marginBottom: 14 },
  });
}
