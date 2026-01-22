# Streaming.Center API - Podcasts API

## Обзор

Podcasts API позволяет управлять подкастами и их эпизодами. Подкасты могут быть созданы, получены и управляемы через REST API.

## Endpoints

### Получение списка подкастов

```
GET /api/v2/podcasts/
```

### Создание подкаста

```
POST /api/v2/podcasts/
```

### Получение эпизодов подкаста

```
GET /api/v2/podcasts/{podcast_id}/episodes/
```

Где `{podcast_id}` — ID подкаста.

## Получение списка подкастов

### Параметры запроса (GET)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `limit` | integer | Количество подкастов в ответе | Нет |
| `offset` | integer | Смещение для пагинации (по умолчанию 0) | Нет |
| `server` | integer | ID сервера для фильтрации | Нет |

### Пример запроса

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/podcasts/?limit=100`, {
  headers: {
    "SC-API-KEY": apiKey,
  },
});

const podcasts = await response.json();
console.log(podcasts);
```

### Структура данных подкаста

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | Уникальный идентификатор подкаста |
| `name` | string | Название подкаста |
| `description` | string | Описание подкаста |
| `author` | string | Автор подкаста |
| `image` | string | URL изображения подкаста |
| `created_at` | string | Дата создания |
| `updated_at` | string | Дата последнего обновления |

## Создание подкаста

### Параметры запроса (POST)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `name` | string | Название подкаста | Да |
| `description` | string | Описание подкаста | Нет |
| `author` | string | Автор подкаста | Нет |
| `image` | string | URL изображения | Нет |
| `server` | integer | ID сервера | Нет |

### Пример создания подкаста

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/podcasts/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "My Podcast",
    description: "Description of my podcast",
    author: "Author Name",
    server: 1,
  }),
});

const podcast = await response.json();
console.log("Created podcast:", podcast);
```

## Получение эпизодов подкаста

### Параметры запроса (GET)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `limit` | integer | Количество эпизодов в ответе | Нет |
| `offset` | integer | Смещение для пагинации (по умолчанию 0) | Нет |
| `server` | integer | ID сервера для фильтрации | Нет |

### Пример запроса

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";
const podcastId = 1;

const response = await fetch(
  `${apiUrl}/api/v2/podcasts/${podcastId}/episodes/?limit=50&offset=0`,
  {
    headers: {
      "SC-API-KEY": apiKey,
    },
  }
);

const episodes = await response.json();
console.log(episodes);
```

### Структура данных эпизода

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | Уникальный идентификатор эпизода |
| `podcast_id` | integer | ID подкаста |
| `title` | string | Название эпизода |
| `description` | string | Описание эпизода |
| `duration` | integer | Длительность в секундах |
| `published_at` | string | Дата публикации |
| `audio_url` | string | URL аудиофайла |
| `file_path` | string | Путь к файлу на сервере |
| `created_at` | string | Дата создания |
| `updated_at` | string | Дата последнего обновления |

## Примеры ответов

### Список подкастов

```json
[
  {
    "id": 1,
    "name": "My Podcast",
    "description": "Description of my podcast",
    "author": "Author Name",
    "image": "https://your-server.streaming.center/media/podcast_image.jpg",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "name": "Another Podcast",
    "description": "Another podcast description",
    "author": "Another Author",
    "created_at": "2024-01-16T12:00:00Z",
    "updated_at": "2024-01-16T12:00:00Z"
  }
]
```

### Список эпизодов

```json
[
  {
    "id": 1,
    "podcast_id": 1,
    "title": "Episode 1: Introduction",
    "description": "First episode of the podcast",
    "duration": 3600,
    "published_at": "2024-01-15T10:00:00Z",
    "audio_url": "https://your-server.streaming.center/media/episode1.mp3",
    "file_path": "/media/podcasts/episode1.mp3",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "podcast_id": 1,
    "title": "Episode 2: Deep Dive",
    "description": "Second episode",
    "duration": 4200,
    "published_at": "2024-01-22T10:00:00Z",
    "audio_url": "https://your-server.streaming.center/media/episode2.mp3",
    "file_path": "/media/podcasts/episode2.mp3",
    "created_at": "2024-01-22T10:00:00Z",
    "updated_at": "2024-01-22T10:00:00Z"
  }
]
```

## Пагинация

Для работы с большими списками используйте параметры `limit` и `offset`:

```typescript
async function getAllEpisodes(podcastId: number) {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";
  const allEpisodes = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `${apiUrl}/api/v2/podcasts/${podcastId}/episodes/?limit=${limit}&offset=${offset}`,
      {
        headers: {
          "SC-API-KEY": apiKey,
        },
      }
    );

    const episodes = await response.json();
    
    if (!Array.isArray(episodes) || episodes.length === 0) {
      break;
    }

    allEpisodes.push(...episodes);

    if (episodes.length < limit) {
      break;
    }

    offset += limit;
  }

  return allEpisodes;
}
```

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
      throw new Error("Podcast or episode not found");
    }
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error("Failed to fetch podcasts:", error);
  throw error;
}
```

## Пример запроса (cURL)

### Получение списка подкастов

```bash
curl -H "SC-API-KEY: your-api-key-here" \
     "https://your-server.streaming.center:1030/api/v2/podcasts/?limit=100"
```

### Получение эпизодов подкаста

```bash
curl -H "SC-API-KEY: your-api-key-here" \
     "https://your-server.streaming.center:1030/api/v2/podcasts/1/episodes/?limit=50"
```

### Создание подкаста

```bash
curl -X POST \
     -H "SC-API-KEY: your-api-key-here" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Podcast","description":"Description","author":"Author"}' \
     "https://your-server.streaming.center:1030/api/v2/podcasts/"
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [Playlists API](./04-playlists.md)
