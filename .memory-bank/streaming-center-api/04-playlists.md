# Streaming.Center API - Playlists API

## Обзор

Playlists API позволяет управлять плейлистами и получать информацию о треках в плейлистах. Это основной API, используемый в проекте Track_parser для проверки, какие треки уже находятся на радио.

## Endpoints

### Получение списка плейлистов

```
GET /api/v2/playlists/
```

### Создание плейлиста

```
POST /api/v2/playlists/
```

### Получение треков плейлиста

```
GET /api/v2/playlists/{id}/tracks/
```

Где `{id}` — ID плейлиста.

## Создание плейлиста

### Параметры запроса (POST)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `name` | string | Название плейлиста | Да |
| `is_random` | boolean | Включить случайное воспроизведение | Нет |
| `server` | integer | ID сервера | Нет |

### Пример создания плейлиста

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/playlists/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "My Playlist",
    is_random: true,
    server: 1,
  }),
});

const playlist = await response.json();
console.log("Created playlist:", playlist);
```

## Получение треков плейлиста

### Параметры запроса (GET)

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `limit` | integer | Количество треков в ответе (максимум зависит от настроек API) | Нет |
| `offset` | integer | Смещение для пагинации (по умолчанию 0) | Нет |

### Структура данных трека

Трек в плейлисте может содержать следующие поля (структура может варьироваться):

| Поле | Тип | Описание |
|------|-----|----------|
| `filename` | string | Имя файла трека |
| `name` | string | Название трека |
| `meta` | string | Метаданные трека |
| `public_path` | string | Публичный URL файла |
| `path` | string | Путь к файлу на сервере |
| `track` | object | Вложенный объект с информацией о треке |

**Важно:** API может возвращать данные в разных форматах. В проекте используется гибкая обработка различных вариантов структуры ответа.

### Пример получения треков (TypeScript)

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";
const playlistId = 1;

// Получить первые 100 треков
const response = await fetch(
  `${apiUrl}/api/v2/playlists/${playlistId}/tracks/?limit=100&offset=0`,
  {
    headers: {
      "SC-API-KEY": apiKey,
    },
  }
);

const tracks = await response.json();
console.log(tracks);
```

## Использование в проекте

### Реализация в `lib/radio/streamingCenterClient.ts`

Проект использует Playlists API для:

1. **Получения всех треков из плейлиста** с пагинацией
2. **Сопоставления треков** из базы данных с треками на радио
3. **Синхронизации** списка треков с базой данных

#### Ключевые функции:

```typescript
// Получение всех имен треков из плейлиста
export async function getAllPlaylistTrackNames(
  apiUrl: string,
  apiKey: string,
  playlistId: number
): Promise<Set<string>>

// Синхронизация треков из API
export async function syncFromApi(
  apiUrl: string,
  apiKey: string,
  playlistId: number
): Promise<SyncFromApiEntry[]>
```

#### Пример использования пагинации

```typescript
const PAGE_SIZE = 1000;
let offset = 0;

while (true) {
  const url = `${base}/api/v2/playlists/${playlistId}/tracks/?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { "SC-API-KEY": apiKey },
  });

  const data = await res.json();
  let rows: PlaylistTrackRow[] = [];

  // Обработка различных форматов ответа
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === "object") {
    const arr = data.results ?? data.tracks ?? data.data ?? data.items;
    if (Array.isArray(arr)) {
      rows = arr;
    }
  }

  // Обработка треков...
  for (const row of rows) {
    // Извлечение имени трека из различных полей
    const name = nameFromRow(row);
    // ...
  }

  // Проверка окончания пагинации
  if (rows.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}
```

### Обработка различных форматов ответа

API может возвращать данные в разных форматах:

1. **Массив треков напрямую:**
   ```json
   [
     { "filename": "track1.mp3", ... },
     { "filename": "track2.mp3", ... }
   ]
   ```

2. **Объект с вложенным массивом:**
   ```json
   {
     "results": [...],
     "tracks": [...],
     "data": [...],
     "items": [...]
   }
   ```

Проект обрабатывает все эти варианты:

```typescript
const arr =
  obj.results ??
  obj.tracks ??
  obj.data ??
  obj.items ??
  obj.files ??
  obj.playlist_files ??
  obj.list ??
  obj.records;
```

### Извлечение имени трека

Трек может иметь имя в разных полях. Функция `nameFromRow` проверяет их в следующем порядке:

1. `track.filename`
2. `track.name`
3. `track.meta`
4. `track.public_path` (извлекается basename)
5. `track.path` (извлекается basename)
6. `filename`
7. `name`
8. `meta`
9. `public_path` (извлекается basename)

## Примеры ответов

### Успешный ответ (массив треков)

```json
[
  {
    "filename": "song_title.mp3",
    "name": "Song Title",
    "meta": "Artist - Song Title",
    "public_path": "https://your-server.streaming.center/media/song_title.mp3",
    "path": "/media/Server_1/0 0 ALL_TRACK/song_title.mp3"
  },
  {
    "filename": "another_song.mp3",
    "name": "Another Song",
    "public_path": "https://your-server.streaming.center/media/another_song.mp3"
  }
]
```

### Успешный ответ (объект с результатами)

```json
{
  "count": 1500,
  "next": "https://your-server.streaming.center/api/v2/playlists/1/tracks/?limit=100&offset=100",
  "previous": null,
  "results": [
    {
      "filename": "track1.mp3",
      "name": "Track 1"
    }
  ]
}
```

## Переменные окружения

В проекте используются следующие переменные:

```env
STREAMING_CENTER_API_URL=https://your-server.streaming.center:1030
STREAMING_CENTER_API_KEY=your_api_key_here
STREAMING_CENTER_PLAYLIST_ID=1
```

## Обработка ошибок

```typescript
const response = await fetch(url, {
  headers: { "SC-API-KEY": apiKey },
});

if (!response.ok) {
  throw new Error(
    `Streaming.Center API error: ${response.status} ${response.statusText}`
  );
}

const data = await response.json();

if (!Array.isArray(rows)) {
  throw new Error(
    "Streaming.Center API: expected array of tracks"
  );
}
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [History API](./03-history.md)
