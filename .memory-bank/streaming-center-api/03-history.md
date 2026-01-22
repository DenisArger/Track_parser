# Streaming.Center API - History API

## Обзор

History API предоставляет доступ к истории воспроизведенных треков (What's on air). Позволяет получить информацию о том, какие треки были воспроизведены на радиостанции.

## Endpoint

```
GET /api/v2/history/
```

## Параметры запроса

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `limit` | integer | Количество записей в ответе (по умолчанию зависит от настроек API) | Нет |
| `offset` | integer | Смещение для пагинации (по умолчанию 0) | Нет |
| `server` | integer | ID сервера для фильтрации (если используется несколько серверов) | Нет |

## Структура ответа

Каждая запись в истории содержит следующую информацию:

| Поле | Тип | Описание |
|------|-----|----------|
| `album` | string | Название альбома |
| `author` | string | Исполнитель/автор трека |
| `title` | string | Название трека |
| `ts` | string/integer | Временная метка воспроизведения (timestamp) |
| `length` | integer | Длина трека в секундах |
| `filename` | string | Имя файла трека |
| `path` | string | Путь к файлу |
| `public_path` | string | Публичный URL файла (если доступен) |

## Примеры запросов

### Базовый запрос (TypeScript)

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

// Получить последние 50 треков
const response = await fetch(
  `${apiUrl}/api/v2/history/?limit=50`,
  {
    headers: {
      "SC-API-KEY": apiKey,
    },
  }
);

const history = await response.json();
console.log(history);
```

### С пагинацией

```typescript
async function getHistoryPage(limit: number = 100, offset: number = 0) {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";

  const response = await fetch(
    `${apiUrl}/api/v2/history/?limit=${limit}&offset=${offset}`,
    {
      headers: {
        "SC-API-KEY": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Получить первую страницу
const page1 = await getHistoryPage(100, 0);

// Получить вторую страницу
const page2 = await getHistoryPage(100, 100);
```

### Фильтрация по серверу

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";
const serverId = 1;

const response = await fetch(
  `${apiUrl}/api/v2/history/?limit=100&server=${serverId}`,
  {
    headers: {
      "SC-API-KEY": apiKey,
    },
  }
);

const history = await response.json();
```

### Пример запроса (cURL)

```bash
curl -H "SC-API-KEY: your-api-key-here" \
     "https://your-server.streaming.center:1030/api/v2/history/?limit=50&offset=0"
```

## Пример ответа

```json
[
  {
    "album": "Greatest Hits",
    "author": "Artist Name",
    "title": "Song Title",
    "ts": "2024-01-15T10:30:00Z",
    "length": 240,
    "filename": "song_title.mp3",
    "path": "/media/Server_1/0 0 ALL_TRACK/song_title.mp3",
    "public_path": "https://your-server.streaming.center/media/song_title.mp3"
  },
  {
    "album": "Another Album",
    "author": "Another Artist",
    "title": "Another Song",
    "ts": "2024-01-15T10:26:00Z",
    "length": 195,
    "filename": "another_song.mp3",
    "path": "/media/Server_1/0 0 ALL_TRACK/another_song.mp3",
    "public_path": "https://your-server.streaming.center/media/another_song.mp3"
  }
]
```

## Использование в проекте

В проекте Track_parser History API может использоваться для:

- Отображения истории воспроизведенных треков
- Анализа популярности треков
- Проверки, какие треки были недавно воспроизведены

## Обработка ошибок

```typescript
try {
  const response = await fetch(url, {
    headers: { "SC-API-KEY": apiKey },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API key");
    }
    if (response.status === 404) {
      throw new Error("History endpoint not found");
    }
    throw new Error(`API error: ${response.status}`);
  }

  const history = await response.json();
  return history;
} catch (error) {
  console.error("Failed to fetch history:", error);
  throw error;
}
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [Playlists API](./04-playlists.md)
