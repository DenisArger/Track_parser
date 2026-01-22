# Streaming.Center API - Документация

Полная документация по использованию Streaming.Center API в проекте Track_parser.

## Содержание

1. [Введение](./01-introduction.md)
   - Общая информация об API
   - Базовый URL и форматы данных
   - Требования и примеры использования

2. [Аутентификация](./02-authentication.md)
   - Получение и использование API ключей
   - Безопасность и лучшие практики
   - Обработка ошибок аутентификации

3. [History API](./03-history.md)
   - История воспроизведенных треков (What's on air)
   - Параметры запроса и структура ответа
   - Примеры использования

4. [Playlists API](./04-playlists.md)
   - Управление плейлистами
   - Получение треков из плейлистов
   - Использование в проекте Track_parser

5. [Podcasts API](./05-podcasts.md)
   - Управление подкастами и эпизодами
   - Создание и получение подкастов
   - Работа с эпизодами

6. [Admin Area API](./06-admin-api.md)
   - Административные функции (v1 API)
   - Управление broadcasters, resellers, templates
   - Аутентификация через токены

7. [Scheduler API](./07-scheduler-api.md)
   - Управление сеткой вещания
   - Планирование запуска плейлистов
   - Запуск треков в определенное время
   - Управление джинглами и рекламой

## Быстрый старт

### Настройка переменных окружения

Добавьте в файл `.env`:

```env
STREAMING_CENTER_API_URL=https://your-server.streaming.center:1030
STREAMING_CENTER_API_KEY=your_api_key_here
STREAMING_CENTER_PLAYLIST_ID=1
```

### Базовый пример использования

```typescript
import { getAllPlaylistTrackNames } from "@/lib/radio/streamingCenterClient";

const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
const playlistId = parseInt(process.env.STREAMING_CENTER_PLAYLIST_ID || "1", 10);

// Получить все имена треков из плейлиста
const trackNames = await getAllPlaylistTrackNames(apiUrl, apiKey, playlistId);
console.log(`Found ${trackNames.size} tracks in playlist`);
```

## Использование в проекте

### Основные файлы

- **`lib/radio/streamingCenterClient.ts`** — клиент для работы с Streaming.Center API
  - `getAllPlaylistTrackNames()` — получение всех имен треков из плейлиста
  - `syncFromApi()` — синхронизация треков из API
  - `checkTracksOnRadio()` — проверка, какие треки уже на радио

- **`lib/radio/radioTracks.ts`** — работа с треками на радио
  - `getRadioTrackNamesSet()` — получение Set имен треков из БД
  - `syncRadioTracksFromApi()` — синхронизация треков с API

- **`app/api/radio/check-batch/route.ts`** — API endpoint для проверки треков
- **`app/api/radio/sync/route.ts`** — API endpoint для синхронизации

### Основные функции

#### Проверка треков на радио

```typescript
import { checkTracksOnRadio } from "@/lib/radio/streamingCenterClient";
import { getRadioTrackNamesSet } from "@/lib/radio/radioTracks";

const radioSet = await getRadioTrackNamesSet();
const tracks = [
  { id: "1", metadata: { title: "Song", artist: "Artist" } },
  // ...
];

const results = checkTracksOnRadio(tracks, radioSet);
// results: { "1": true, ... }
```

#### Синхронизация треков

```typescript
import { syncRadioTracksFromApi } from "@/lib/radio/radioTracks";

const { count } = await syncRadioTracksFromApi();
console.log(`Synced ${count} tracks from Streaming.Center`);
```

## API Endpoints проекта

### Проверка треков на радио

```
POST /api/radio/check-batch
```

Проверяет, какие треки из запроса уже есть в плейлисте Streaming.Center.

**Тело запроса:**
```json
{
  "tracks": [
    {
      "id": "track-id",
      "metadata": {
        "title": "Song Title",
        "artist": "Artist Name"
      }
    }
  ]
}
```

**Ответ:**
```json
{
  "results": {
    "track-id": true
  }
}
```

### Синхронизация треков

```
POST /api/radio/sync
```

Загружает список треков из плейлиста Streaming.Center в базу данных.

**Ответ:**
```json
{
  "success": true,
  "count": 1500
}
```

## Структура данных

### Трек в плейлисте

Трек может содержать следующие поля (в зависимости от формата ответа API):

- `filename` — имя файла
- `name` — название трека
- `meta` — метаданные
- `public_path` — публичный URL
- `path` — путь к файлу
- `track` — вложенный объект с информацией о треке

Проект обрабатывает различные форматы ответа API автоматически.

## Безопасность

### Обязательные требования

1. **Используйте HTTPS** для всех запросов к API
2. **Храните API ключи в переменных окружения**, не в коде
3. **Не коммитьте `.env` файлы** в Git
4. **Регулярно ротируйте API ключи**

### Рекомендации

- Используйте разные API ключи для разных окружений
- Ограничьте права доступа API ключей в панели управления
- Мониторьте использование API ключей

## Официальная документация

Для получения актуальной информации обращайтесь к официальной документации Streaming.Center:

- В панели управления: **Settings → API Keys**
- Официальный сайт: [streaming.center](https://streaming.center)

## Версии API

- **v2** (`/api/v2/`) — основная версия, используется для плейлистов, истории, подкастов, scheduler
- **v1** (`/api/v1/`) — административная версия, используется для управления системой

## Управление сеткой вещания

Streaming.Center поддерживает функции планирования вещания (scheduler) через веб-интерфейс панели управления.

**⚠️ Важно:** Официальная публичная документация по Scheduler API endpoints отсутствует. Функции планирования доступны через панель управления, но API endpoints не документированы публично.

Подробнее см. [Scheduler API](./07-scheduler-api.md) — информация о проверке доступности API.

## Поддержка

При возникновении проблем:

1. Проверьте правильность API ключа и URL
2. Убедитесь, что используется HTTPS
3. Проверьте логи в консоли браузера/сервера
4. Обратитесь к официальной документации Streaming.Center

## Лицензия

Документация создана для проекта Track_parser. Streaming.Center является коммерческим продуктом.
