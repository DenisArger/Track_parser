# Streaming.Center API - Scheduler API

## Обзор

Scheduler API в Streaming.Center представлен endpoint'ом `/api/v2/grid/`.
Он позволяет получать события сетки вещания и создавать новые события расписания.
В проекте Track_parser управление сеткой считается админской функцией.

## Endpoint

```
GET /api/v2/grid/
POST /api/v2/grid/
PUT /api/v2/grid/{id}/
DELETE /api/v2/grid/{id}/
```

## Аутентификация

- `GET` - не требуется
- `POST` - требуется `SC-API-KEY`

## Параметры запроса для GET

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `server` | integer | ID радиосервера | Да |
| `start_ts` | integer | Начало диапазона как Unix timestamp | Да |
| `end_ts` | integer | Конец диапазона как Unix timestamp | Да |
| `utc` | integer | `1`, если `start_ts` и `end_ts` переданы в UTC | Нет |

## Что делает GET

Официальная документация указывает, что при запросе списка событий API:

- загружает события для выбранного сервера;
- разворачивает периодические события в реальные occurrences;
- автоматически вычисляет `finish_date`, `finish_time` и `end_ts`;
- может добавлять служебное событие окончания radioshow.

## Структура события

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer/null | ID события, у служебных событий может быть `null` |
| `server` | integer | ID радиосервера |
| `name` | string | Название события |
| `periodicity` | string | `onetime` или `periodic` |
| `cast_type` | string | Тип события: `playlist`, `radioshow`, `relay`, `rotation` |
| `break_track` | boolean | Нужно ли прерывать текущий трек |
| `start_playlist_from_beginning` | boolean | Запускать плейлист с начала |
| `start_date` | string | Дата старта |
| `start_time` | string | Время старта |
| `finish_date` | string | Дата завершения |
| `finish_time` | string | Время завершения |
| `playlist` | integer/null | ID плейлиста |
| `playlist_after_radioshow` | integer/null | Плейлист после radioshow |
| `rotation_after_radioshow` | integer/null | Rotation после radioshow |
| `dj` | integer/null | ID DJ |
| `rotation` | integer/null | ID rotation |
| `allow_jingles` | boolean | Разрешить jingles |
| `allow_song_requests` | boolean | Разрешить song requests |
| `allow_jingles_after` | boolean | Разрешить jingles после radioshow |
| `allow_song_requests_after` | boolean | Разрешить song requests после radioshow |
| `color` | string | Основной цвет события |
| `color2` | string/null | Второй цвет события |
| `local_time` | string | Локальное время события |
| `timezone` | string | Таймзона события |
| `parent_id` | integer/null | ID родительского radioshow события |
| `start_ts` | integer | Unix timestamp старта |
| `start_ts_utc_readable` | string | Читаемое UTC-время старта |
| `end_ts` | integer | Unix timestamp завершения |
| `wd_mon` | boolean | Повторять по понедельникам |
| `wd_tue` | boolean | Повторять по вторникам |
| `wd_wed` | boolean | Повторять по средам |
| `wd_thu` | boolean | Повторять по четвергам |
| `wd_fri` | boolean | Повторять по пятницам |
| `wd_sat` | boolean | Повторять по субботам |
| `wd_sun` | boolean | Повторять по воскресеньям |
| `week_1` | boolean | Первая неделя месяца |
| `week_2` | boolean | Вторая неделя месяца |
| `week_3` | boolean | Третья неделя месяца |
| `week_4` | boolean | Четвёртая неделя месяца |

## Параметры POST

При создании события используются поля:

- `server`
- `name`
- `periodicity`
- `cast_type`
- `break_track`
- `start_playlist_from_beginning`
- `start_date`
- `start_time`
- `finish_date`
- `finish_time`
- `wd_mon` ... `wd_sun`
- `week_1` ... `week_4`
- `playlist`
- `playlist_after_radioshow`
- `rotation_after_radioshow`
- `dj`
- `rotation`
- `allow_jingles`
- `allow_song_requests`
- `allow_jingles_after`
- `allow_song_requests_after`
- `color`
- `color2`
- `local_time`
- `timezone`

## Обновление и удаление события

Для работы с конкретным событием используются пути:

- `PUT /api/v2/grid/{id}/` - обновление события;
- `DELETE /api/v2/grid/{id}/` - удаление события.

В интерфейсе Track_parser эти операции доступны только пользователям с ролью `admin`.

## Валидация

При создании или обновлении события API может вернуть ошибки:

- `repeat_week_days_not_set`
- `repeat_weeks_not_set`
- `playlist_required`
- `time_slot_busy`

## Пример GET

```typescript
const apiUrl = "https://your-server.streaming.center:1030";

const response = await fetch(
  `${apiUrl}/api/v2/grid/?server=1&start_ts=1744041600&end_ts=1744646400&utc=1`
);

const schedule = await response.json();
console.log(schedule);
```

## Пример POST

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/grid/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    server: 1,
    name: "Morning playlist",
    periodicity: "onetime",
    cast_type: "playlist",
    break_track: true,
    start_playlist_from_beginning: true,
    start_date: "2026-04-08",
    start_time: "08:00:00",
    playlist: 2,
    local_time: "08:00:00",
    timezone: "Europe/Moscow",
    color: "#87c95f",
  }),
});

const createdEvent = await response.json();
console.log(createdEvent);
```

## Пример ответа

Официальная страница показывает, что ответ представляет собой массив событий.

## Ограничения доступа

- Неадмины не должны видеть интерфейс управления сеткой.
- Серверные маршруты управления сеткой должны возвращать `403` для неадминов.

## Связанные документы

- [Введение](./01-introduction.md)
- [Playlists API](./04-playlists.md)
- [Admin Area API](./06-admin-api.md)
