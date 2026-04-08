# Streaming.Center API - History API

## Обзор

History API предоставляет доступ к истории воспроизведенных треков (What's on air). Позволяет получить информацию о том, какие треки были воспроизведены на радиостанции.

На официальной странице API раздел "What's on air" показывает запрос к `/api/v2/history/` как способ получить текущий и недавние треки.

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
| `ts` | integer | Временная метка воспроизведения в миллисекундах |
| `length` | integer | Длина трека в миллисекундах |
| `dj_name` | string | Имя DJ или источника воспроизведения |
| `playlist_title` | string | Название плейлиста |
| `metadata` | string | Человекочитаемые метаданные трека |
| `img_url` | string | URL обложки |
| `img_medium_url` | string | URL средней обложки |
| `img_large_url` | string | URL большой обложки |

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

### Пример формата ответа с сайта

Официальная документация показывает ответ в формате пагинированного объекта:

```json
{
  "count": 500,
  "next": "https://demoaccount.streaming.center:8080/api/v2/history/?limit=1&offset=1&server=1",
  "previous": null,
  "results": [
    {
      "album": "Ozzmosis (Expanded Edition)",
      "author": "Ozzy Osbourne",
      "dj_name": "AutoDJ",
      "metadata": "Ozzy Osbourne - I Just Want You",
      "playlist_title": "All music",
      "title": "I Just Want You",
      "ts": 1733763534000,
      "length": 296347,
      "img_url": "https://demoaccount.streaming.center:8080/media/tracks/trackImage1190.jpg"
    }
  ]
}
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
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "album": "Greatest Hits",
      "author": "Artist Name",
      "title": "Song Title",
      "ts": 1736937000000,
      "length": 240000,
      "playlist_title": "All music",
      "metadata": "Artist Name - Song Title",
      "dj_name": "AutoDJ",
      "img_url": "https://your-server.streaming.center/media/track.jpg"
    }
  ]
}
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
