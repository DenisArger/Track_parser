# Streaming.Center API - Podcasts API

## Обзор

Podcasts API позволяет создавать подкасты, получать один подкаст по ID, получать список эпизодов и скачивать MP3-файл эпизода.

## Endpoints

### Получение списка подкастов

```
GET /api/v2/podcasts/
```

### Создание подкаста

```
POST /api/v2/podcasts/
```

### Получение одного подкаста

```
GET /api/v2/podcasts/{id}/
```

### Получение эпизодов подкаста

```
GET /api/v2/podcasts/{podcast_id}/episodes/
```

### Получение одного эпизода

```
GET /api/v2/podcasts/{podcast_id}/episodes/{episode_id}/
```

### Скачать MP3 эпизода

```
GET /api/v2/podcasts/{podcast_id}/episodes/{episode_id}/episode.mp3/
```

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
| `title` | string | Название подкаста |
| `published` | boolean | Опубликован ли подкаст |
| `description` | string | Описание подкаста |
| `server` | integer | ID сервера |

## Создание подкаста

### Параметры запроса (POST)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `title` | string | Название подкаста | Да |
| `published` | boolean | Опубликовать подкаст | Нет |
| `description` | string | Описание подкаста | Нет |
| `server` | integer | ID сервера | Нет |

На официальной странице указано, что при необходимости загрузить обложку нужно отправлять `multipart/form-data` и передавать изображение в поле `image`.

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
    title: "My Podcast",
    published: true,
    description: "Description of my podcast",
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
| `file` | string | Имя файла эпизода |
| `published` | boolean | Опубликован ли эпизод |

## Примеры ответов

### Список подкастов

```json
[
  {
    "id": 1,
    "title": "My Podcast",
    "published": true,
    "description": "Description of my podcast",
    "server": 1
  },
  {
    "id": 2,
    "title": "Another Podcast",
    "published": false,
    "description": "Another podcast description",
    "server": 1
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
    "file": "episode1.mp3",
    "published": true
  },
  {
    "id": 2,
    "podcast_id": 1,
    "title": "Episode 2: Deep Dive",
    "description": "Second episode",
    "file": "episode2.mp3",
    "published": true
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
     -d '{"title":"My Podcast","published":true,"description":"Description","server":1}' \
     "https://your-server.streaming.center:1030/api/v2/podcasts/"
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [Playlists API](./04-playlists.md)
