# Streaming.Center API - Введение

## Общая информация

Streaming.Center предоставляет API для получения данных о том, что сейчас в эфире, а также для работы с плейлистами, подкастами и административными функциями платформы.

API можно использовать для своих скриптов, приложений, модулей для сайта радиостанции, мобильных приложений и любой другой интеграции, где нужен программный доступ к данным радиосервера.

## Базовый URL

```
<control-panel-address>/api/v2/
```

Где `<control-panel-address>` — адрес вашей панели управления Streaming.Center, то есть URL, по которому вы обычно входите в интерфейс broadcaster/admin.

Пример:

```text
https://demoaccount.streaming.center:8080/api/v2/
```

## Форматы данных

API поддерживает два формата ответов:

- **JSON** — стандартный формат для программного доступа
- **JSONP** — для сценариев, где нужен JSONP-ответ

## Требования

### HTTPS

**Критически важно:** Для защищенных запросов, особенно если используются данные авторизации, рекомендуется HTTPS. На сайте отдельно отмечено, что при запросах с авторизацией HTTPS критически необходим.

### Аутентификация

Для части запросов API требуется аутентификация через API-ключ, который передается в HTTP-заголовке `SC-API-KEY`. Подробнее см. [02-authentication.md](./02-authentication.md).

## Версии API

- **v2** — основная версия API для публичных данных (`/api/v2/`)
- **v1** — API административной панели (`/api/v1/`)

## Примеры использования

### Базовый запрос (TypeScript)

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/playlists/`, {
  headers: {
    "SC-API-KEY": apiKey,
  },
});

const data = await response.json();
```

### Пример запроса истории эфира

На официальной странице в качестве примера показан запрос истории треков:

```typescript
const response = await fetch(
  "https://demoaccount.streaming.center:8080/api/v2/history/?limit=1&offset=0&server=1"
);

const data = await response.json();
```

Ответ содержит поля `count`, `next`, `previous` и `results`, а в `results` обычно лежат данные о треке, включая:

- `title`
- `author`
- `album`
- `playlist_title`
- `metadata`
- `ts`
- `length`
- `img_url`, `img_medium_url`, `img_large_url`

### Использование в проекте

В проекте Track_parser API используется в файле `lib/radio/streamingCenterClient.ts`:

```typescript
// Пример из проекта
const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
const res = await fetch(url, {
  headers: { "SC-API-KEY": apiKey },
});
```

## Переменные окружения

Для работы с API в проекте используются следующие переменные окружения:

```env
STREAMING_CENTER_API_URL=https://your-server.streaming.center:1030
STREAMING_CENTER_API_KEY=your_api_key_here
STREAMING_CENTER_PLAYLIST_ID=1
```

## Разделы документации

1. [Введение](./01-introduction.md) (текущий документ)
2. [Аутентификация](./02-authentication.md)
3. [History API](./03-history.md) — история треков (What's on air)
4. [Playlists API](./04-playlists.md) — управление плейлистами
5. [Podcasts API](./05-podcasts.md) — управление подкастами
6. [Admin Area API](./06-admin-api.md) — административные функции
7. [Scheduler API](./07-scheduler-api.md) — управление сеткой вещания и планирование
8. [Broadcast Channels API](./08-channels-api.md) — вещательные каналы и стримы

## Официальная документация

Официальная точка входа по API: [Getting started with Streaming.Center API](https://streaming.center/docs/api/intro/).

В панели управления также указан путь к документации через раздел `Settings → API Keys`.
