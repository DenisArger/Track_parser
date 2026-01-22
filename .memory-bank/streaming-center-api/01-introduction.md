# Streaming.Center API - Введение

## Общая информация

Streaming.Center предоставляет REST API для управления радиостанциями, плейлистами, подкастами и другими функциями платформы.

## Базовый URL

```
<control-panel-address>/api/v2/
```

Где `<control-panel-address>` — адрес вашей панели управления Streaming.Center (например, `https://your-server.streaming.center:1030`).

## Форматы данных

API поддерживает два формата ответов:

- **JSON** — стандартный формат для программного доступа
- **JSONP** — для использования в браузерах с поддержкой CORS

## Требования

### HTTPS

**Критически важно:** Для защищенных запросов (особенно при передаче API ключей) необходимо использовать HTTPS. Использование HTTP может привести к утечке конфиденциальных данных.

### Аутентификация

Все запросы к API требуют аутентификации через API ключ, передаваемый в HTTP заголовке `SC-API-KEY`. Подробнее см. [02-authentication.md](./02-authentication.md).

## Версии API

- **v2** — основная версия API (`/api/v2/`)
- **v1** — устаревшая версия, используется для Admin Area API (`/api/v1/`)

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

## Официальная документация

Для получения актуальной информации обращайтесь к официальной документации Streaming.Center в разделе Settings → API Keys вашей панели управления.
