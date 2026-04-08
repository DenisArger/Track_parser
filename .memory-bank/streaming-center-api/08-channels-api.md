# Streaming.Center API - Broadcast Channels API

## Обзор

Broadcast Channels API предоставляет доступ к списку вещательных каналов радиостанции и позволяет создавать, получать, обновлять и удалять каналы.

## Endpoint

```
GET /api/v2/channels/
POST /api/v2/channels/
GET /api/v2/channels/{id}/
PUT /api/v2/channels/{id}/
DELETE /api/v2/channels/{id}/
```

## Аутентификация

- `GET` - не требуется
- `POST`, `PUT`, `DELETE` - требуется `SC-API-KEY`

## Параметры GET списка

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `limit` | integer | Количество элементов в ответе | Нет |
| `offset` | integer | Смещение пагинации | Нет |
| `server` | integer | ID радиосервера | Да |

## Структура ответа списка

Ответ использует стандартную пагинацию:

- `count`
- `next`
- `previous`
- `results`

## Поля канала

### Публичные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | Уникальный ID канала |
| `active` | boolean | Активен ли канал |
| `server` | integer | ID радиосервера |
| `bitrate` | string | Битрейт потока |
| `listeners` | string | Лимит слушателей |
| `s_type` | string | Тип стрим-сервера |
| `s_format` | string | Формат потока |
| `ip_address` | string | IP адрес потока |
| `port` | integer | Основной порт |
| `ssl_port` | integer | SSL порт |
| `mount_point` | string | Точка монтирования |
| `public` | boolean | Публичный ли канал |
| `traf` | integer | Накопленный трафик |
| `traf_month` | integer | Месяц статистики трафика |
| `autodj_enabled` | boolean | Включен ли AutoDJ |
| `centovacast_compatible` | boolean | Совместимость с Centova Cast |
| `proxy_enabled` | boolean | Включен ли HTTP proxy |
| `proxy_status` | integer | Статус HTTP proxy |
| `proxy_url_path` | string/null | Путь HTTP proxy |
| `ssl_proxy_enabled` | boolean | Включен ли HTTPS proxy |
| `ssl_proxy_status` | integer | Статус HTTPS proxy |
| `ssl_proxy_url_path` | string/null | Путь HTTPS proxy |
| `allow_auth_listeners_only` | boolean | Только авторизованные слушатели |
| `queue_size` | integer | Размер буфера |
| `burst_size` | integer | Размер burst buffer |
| `listeners_current` | integer | Текущее число слушателей |
| `listeners_peak` | integer | Пиковое число слушателей |
| `traffic` | string | Человеко-читаемый трафик |
| `state` | integer | Состояние канала |
| `links_html` | string | HTML блок со ссылками |
| `stream_url` | string | Прямой HTTP stream URL |
| `secure_stream_url` | string | HTTPS stream URL |
| `admin_link` | string | Ссылка на admin страницы стрим-сервера |
| `youtube_stream_image` | string/null | Картинка/видео для YouTube |
| `fb_stream_image` | string/null | Картинка/видео для Facebook |
| `vk_stream_image` | string/null | Картинка/видео для VK |
| `telegram_stream_image` | string/null | Картинка/видео для Telegram |
| `rutube_stream_image` | string/null | Картинка/видео для RuTube |

### Состояние `state`

- `0` - offline
- `1` - online, but not connected
- `2` - online and connected

### Дополнительные поля для авторизованного GET

Если запрос авторизован, ответ может дополнительно содержать:

- `password`
- `admin_password`
- `sc_authhash`
- `youtube_stream_url`
- `youtube_stream_key`
- `youtube_stream_enabled`
- `fb_stream_url`
- `fb_stream_key`
- `fb_stream_enabled`
- `vk_stream_url`
- `vk_stream_key`
- `vk_stream_enabled`
- `telegram_stream_url`
- `telegram_stream_key`
- `telegram_stream_enabled`
- `rutube_stream_url`
- `rutube_stream_key`
- `rutube_stream_enabled`
- `shoutcast_uid`
- `shoutcast_license_key`
- `awstats_nginx`
- `vhost_name`
- `proxy_stream_url`
- `ssl_proxy_stream_url`
- `awstats_password`
- `hls_url`
- `hls_status`

## Пример GET

```typescript
const apiUrl = "https://your-server.streaming.center:1030";

const response = await fetch(
  `${apiUrl}/api/v2/channels/?limit=20&offset=0&server=1`
);

const channels = await response.json();
console.log(channels);
```

## Пример POST

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/channels/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    server: 1,
    port: 8000,
    bitrate: "128",
    listeners: "500",
    s_type: "icecast",
    s_format: "mp3",
    public: true,
    autodj_enabled: true,
    centovacast_compatible: true,
  }),
});

const createdChannel = await response.json();
console.log(createdChannel);
```

## Полезно для проекта

Этот раздел помогает связать:

- `server` из playlist/history/scheduler с конкретным каналом;
- stream URL и порт;
- текущее состояние вещания;
- HLS и HTTPS/HTTP потоки.

## Связанные документы

- [Введение](./01-introduction.md)
- [Playlists API](./04-playlists.md)
- [Scheduler API](./07-scheduler-api.md)
- [Admin Area API](./06-admin-api.md)
