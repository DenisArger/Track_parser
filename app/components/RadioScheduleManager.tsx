"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDateRange, type GridEvent, type GridEventInput } from "@/lib/radio/streamingCenterGridClient";

type FormState = {
  id?: number;
  server: string;
  name: string;
  periodicity: "onetime" | "periodic";
  cast_type: "playlist" | "radioshow" | "relay" | "rotation";
  start_date: string;
  start_time: string;
  finish_date: string;
  finish_time: string;
  playlist: string;
  playlist_after_radioshow: string;
  rotation_after_radioshow: string;
  dj: string;
  rotation: string;
  local_time: string;
  timezone: string;
  color: string;
  color2: string;
  break_track: boolean;
  start_playlist_from_beginning: boolean;
  allow_jingles: boolean;
  allow_song_requests: boolean;
  allow_jingles_after: boolean;
  allow_song_requests_after: boolean;
  wd_mon: boolean;
  wd_tue: boolean;
  wd_wed: boolean;
  wd_thu: boolean;
  wd_fri: boolean;
  wd_sat: boolean;
  wd_sun: boolean;
  week_1: boolean;
  week_2: boolean;
  week_3: boolean;
  week_4: boolean;
};

const emptyForm = (): FormState => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    server: "1",
    name: "",
    periodicity: "onetime",
    cast_type: "playlist",
    start_date: today,
    start_time: "08:00:00",
    finish_date: today,
    finish_time: "09:00:00",
    playlist: "",
    playlist_after_radioshow: "",
    rotation_after_radioshow: "",
    dj: "",
    rotation: "",
    local_time: "08:00:00",
    timezone: "UTC",
    color: "#1d4ed8",
    color2: "",
    break_track: true,
    start_playlist_from_beginning: true,
    allow_jingles: false,
    allow_song_requests: false,
    allow_jingles_after: false,
    allow_song_requests_after: false,
    wd_mon: false,
    wd_tue: false,
    wd_wed: false,
    wd_thu: false,
    wd_fri: false,
    wd_sat: false,
    wd_sun: false,
    week_1: false,
    week_2: false,
    week_3: false,
    week_4: false,
  };
};

function parseNumber(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function toPayload(form: FormState): GridEventInput {
  return {
    server: Number.parseInt(form.server, 10) || 1,
    name: form.name.trim(),
    periodicity: form.periodicity,
    cast_type: form.cast_type,
    start_date: form.start_date,
    start_time: form.start_time,
    finish_date: form.finish_date || undefined,
    finish_time: form.finish_time || undefined,
    playlist: parseNumber(form.playlist),
    playlist_after_radioshow: parseNumber(form.playlist_after_radioshow),
    rotation_after_radioshow: parseNumber(form.rotation_after_radioshow),
    dj: parseNumber(form.dj),
    rotation: parseNumber(form.rotation),
    local_time: form.local_time,
    timezone: form.timezone || "UTC",
    color: form.color,
    color2: form.color2 || null,
    break_track: form.break_track,
    start_playlist_from_beginning: form.start_playlist_from_beginning,
    allow_jingles: form.allow_jingles,
    allow_song_requests: form.allow_song_requests,
    allow_jingles_after: form.allow_jingles_after,
    allow_song_requests_after: form.allow_song_requests_after,
    wd_mon: form.wd_mon,
    wd_tue: form.wd_tue,
    wd_wed: form.wd_wed,
    wd_thu: form.wd_thu,
    wd_fri: form.wd_fri,
    wd_sat: form.wd_sat,
    wd_sun: form.wd_sun,
    week_1: form.week_1,
    week_2: form.week_2,
    week_3: form.week_3,
    week_4: form.week_4,
  };
}

function fromEvent(event: GridEvent): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...emptyForm(),
    id: typeof event.id === "number" ? event.id : undefined,
    server: String(event.server ?? 1),
    name: String(event.name ?? ""),
    periodicity: (event.periodicity as FormState["periodicity"]) || "onetime",
    cast_type: (event.cast_type as FormState["cast_type"]) || "playlist",
    start_date: String(event.start_date ?? today),
    start_time: String(event.start_time ?? "08:00:00"),
    finish_date: String(event.finish_date ?? today),
    finish_time: String(event.finish_time ?? "09:00:00"),
    playlist: event.playlist == null ? "" : String(event.playlist),
    playlist_after_radioshow: event.playlist_after_radioshow == null ? "" : String(event.playlist_after_radioshow),
    rotation_after_radioshow: event.rotation_after_radioshow == null ? "" : String(event.rotation_after_radioshow),
    dj: event.dj == null ? "" : String(event.dj),
    rotation: event.rotation == null ? "" : String(event.rotation),
    local_time: String(event.local_time ?? "08:00:00"),
    timezone: String(event.timezone ?? "UTC"),
    color: String(event.color ?? "#1d4ed8"),
    color2: event.color2 == null ? "" : String(event.color2),
    break_track: Boolean(event.break_track),
    start_playlist_from_beginning: Boolean(event.start_playlist_from_beginning),
    allow_jingles: Boolean(event.allow_jingles),
    allow_song_requests: Boolean(event.allow_song_requests),
    allow_jingles_after: Boolean(event.allow_jingles_after),
    allow_song_requests_after: Boolean(event.allow_song_requests_after),
    wd_mon: Boolean(event.wd_mon),
    wd_tue: Boolean(event.wd_tue),
    wd_wed: Boolean(event.wd_wed),
    wd_thu: Boolean(event.wd_thu),
    wd_fri: Boolean(event.wd_fri),
    wd_sat: Boolean(event.wd_sat),
    wd_sun: Boolean(event.wd_sun),
    week_1: Boolean(event.week_1),
    week_2: Boolean(event.week_2),
    week_3: Boolean(event.week_3),
    week_4: Boolean(event.week_4),
  };
}

function formatTs(value?: number | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}

const checkboxOptions: Array<[
  keyof Pick<
    FormState,
    | "break_track"
    | "start_playlist_from_beginning"
    | "allow_jingles"
    | "allow_song_requests"
    | "allow_jingles_after"
    | "allow_song_requests_after"
    | "wd_mon"
    | "wd_tue"
    | "wd_wed"
    | "wd_thu"
    | "wd_fri"
    | "wd_sat"
    | "wd_sun"
    | "week_1"
    | "week_2"
    | "week_3"
    | "week_4"
  >,
  string
]> = [
  ["break_track", "Break track"],
  ["start_playlist_from_beginning", "Start playlist from beginning"],
  ["allow_jingles", "Allow jingles"],
  ["allow_song_requests", "Allow song requests"],
  ["allow_jingles_after", "Allow jingles after"],
  ["allow_song_requests_after", "Allow requests after"],
  ["wd_mon", "Mon"],
  ["wd_tue", "Tue"],
  ["wd_wed", "Wed"],
  ["wd_thu", "Thu"],
  ["wd_fri", "Fri"],
  ["wd_sat", "Sat"],
  ["wd_sun", "Sun"],
  ["week_1", "Week 1"],
  ["week_2", "Week 2"],
  ["week_3", "Week 3"],
  ["week_4", "Week 4"],
];

export default function RadioScheduleManager() {
  const [server, setServer] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState("7");
  const [castTypeFilter, setCastTypeFilter] = useState("all");
  const [events, setEvents] = useState<GridEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const range = useMemo(() => buildDateRange(startDate, Number.parseInt(days, 10) || 7), [startDate, days]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        server,
        start_ts: String(range.startTs),
        end_ts: String(range.endTs),
        utc: "1",
      });
      const response = await fetch(`/api/radio/grid?${params.toString()}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || String(response.status));
      setEvents(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setEvents([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [range.endTs, range.startTs, server]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const resetForm = () => setForm(emptyForm());

  const submit = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = toPayload(form);
      const response = await fetch(form.id ? `/api/radio/grid/${form.id}` : "/api/radio/grid", {
        method: form.id ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || String(response.status));
      setMessage(form.id ? "Событие обновлено" : "Событие создано");
      resetForm();
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить событие из сетки?")) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/radio/grid/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || String(response.status));
      setMessage("Событие удалено");
      await loadEvents();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const eventGroups = useMemo(() => {
    const filtered =
      castTypeFilter === "all"
        ? events
        : events.filter((event) => (event.cast_type || "") === castTypeFilter);
    return [...filtered].sort((a, b) => (a.start_ts ?? 0) - (b.start_ts ?? 0));
  }, [castTypeFilter, events]);

  const daysView = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const count = Math.max(1, Number.parseInt(days, 10) || 7);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(date);
      return {
        key,
        label,
        items: eventGroups.filter((event) => {
          if (!event.start_ts) return false;
          return new Date(event.start_ts * 1000).toISOString().slice(0, 10) === key;
        }),
      };
    });
  }, [days, eventGroups, startDate]);

  const castTypeStyles: Record<string, string> = {
    playlist: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    radioshow: "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30",
    relay: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    rotation: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
  };

  const castTypeLabels: Record<string, string> = {
    playlist: "Playlist",
    radioshow: "Radio show",
    relay: "Relay",
    rotation: "Rotation",
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <label className="space-y-2">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Server ID</span>
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Days</span>
          <input
            type="number"
            min="1"
            max="31"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={loadEvents} className="btn btn-secondary">
          {loading ? "Загрузка..." : "Обновить сетку"}
        </button>
        <button type="button" onClick={resetForm} className="btn btn-secondary">
          Новое событие
        </button>
        {message && <span className="text-sm text-green-600 dark:text-green-400">{message}</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Фильтр:</span>
        {["all", "playlist", "radioshow", "relay", "rotation"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setCastTypeFilter(type)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              castTypeFilter === type
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {type === "all" ? "Все" : castTypeLabels[type]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {daysView.map((day) => (
              <div key={day.key} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <div className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {day.label}
                  </div>
                  <div className="text-xs text-gray-500">{day.key}</div>
                </div>
                <div className="p-3 space-y-2 min-h-28">
                  {day.items.length === 0 ? (
                    <div className="text-sm text-gray-500">Пусто</div>
                  ) : (
                    day.items.map((event) => (
                      <button
                        key={String(event.id ?? `${event.name}-${event.start_ts}`)}
                        type="button"
                        onClick={() => setForm(fromEvent(event))}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors hover:opacity-95 ${
                          castTypeStyles[(event.cast_type || "") as string] || "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm line-clamp-1">{event.name || "Без названия"}</div>
                          <span className="rounded-full bg-white/70 dark:bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-700 dark:text-gray-200">
                            {event.cast_type || "event"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTs(event.start_ts)} · {event.cast_type}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">События</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {eventGroups.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">{loading ? "Загрузка..." : "Нет событий"}</div>
            ) : (
              eventGroups.map((event) => (
                <button
                  key={String(event.id ?? `${event.name}-${event.start_ts}`)}
                  type="button"
                  onClick={() => setForm(fromEvent(event))}
                  className="block w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{event.name || "Без названия"}</div>
                      <div className="text-sm text-gray-500">
                        {event.cast_type} · {event.periodicity}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>{formatTs(event.start_ts)}</div>
                      <div>{formatTs(event.end_ts)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs">
                      id: {String(event.id ?? "—")}
                    </span>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs">
                      type: {castTypeLabels[event.cast_type || ""] || event.cast_type || "—"}
                    </span>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs">
                      server: {String(event.server ?? "—")}
                    </span>
                    {event.color && (
                      <span className="rounded-full px-2 py-1 text-xs border" style={{ borderColor: event.color }}>
                        {event.color}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div>
            <h3 className="font-semibold">{form.id ? "Редактирование события" : "Новое событие"}</h3>
            <p className="text-sm text-gray-500">Поля ниже передаются в Streaming.Center grid API.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm">Название</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Cast type</span>
              <select className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.cast_type} onChange={(e) => setForm({ ...form, cast_type: e.target.value as FormState["cast_type"] })}>
                <option value="playlist">playlist</option>
                <option value="radioshow">radioshow</option>
                <option value="relay">relay</option>
                <option value="rotation">rotation</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">Periodicity</span>
              <select className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value as FormState["periodicity"] })}>
                <option value="onetime">onetime</option>
                <option value="periodic">periodic</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm">Server</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Start date</span>
              <input type="date" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Start time</span>
              <input type="time" step="1" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Finish date</span>
              <input type="date" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.finish_date} onChange={(e) => setForm({ ...form, finish_date: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Finish time</span>
              <input type="time" step="1" className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.finish_time} onChange={(e) => setForm({ ...form, finish_time: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Playlist</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.playlist} onChange={(e) => setForm({ ...form, playlist: e.target.value })} />
            </label>
          </div>

          <details className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3">
            <summary className="cursor-pointer text-sm font-medium">Показать / скрыть расширенные поля</summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.break_track} onChange={(e) => setForm({ ...form, break_track: e.target.checked })} />
                  <span className="text-sm">Break track</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.start_playlist_from_beginning} onChange={(e) => setForm({ ...form, start_playlist_from_beginning: e.target.checked })} />
                  <span className="text-sm">Start playlist from beginning</span>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm">Local time</span>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.local_time} onChange={(e) => setForm({ ...form, local_time: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm">Timezone</span>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-gray-900" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {checkboxOptions.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(form[key])}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={submit} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? "Сохранение..." : form.id ? "Сохранить" : "Создать"}
            </button>
            {form.id && (
              <button type="button" onClick={() => remove(form.id!)} className="btn btn-secondary">
                Удалить
              </button>
            )}
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Сбросить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
