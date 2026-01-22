# Streaming.Center API - Аутентификация

## Обзор

Все запросы к Streaming.Center API требуют аутентификации через API ключ. Ключ передается в HTTP заголовке запроса.

## Получение API ключа

1. Войдите в панель управления Streaming.Center
2. Перейдите в раздел **Settings → API Keys**
3. Создайте новый API ключ или используйте существующий
4. Скопируйте ключ и сохраните его в безопасном месте

**Важно:** API ключ предоставляет полный доступ к вашему аккаунту. Храните его в секрете и не передавайте третьим лицам.

## Использование API ключа

### HTTP заголовок

API ключ передается в HTTP заголовке `SC-API-KEY`:

```
SC-API-KEY: your-api-key-here
```

### Пример запроса (TypeScript)

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/playlists/`, {
  headers: {
    "SC-API-KEY": apiKey,
  },
});

if (!response.ok) {
  throw new Error(`API error: ${response.status} ${response.statusText}`);
}

const data = await response.json();
```

### Пример запроса (cURL)

```bash
curl -H "SC-API-KEY: your-api-key-here" \
     https://your-server.streaming.center:1030/api/v2/playlists/
```

## Безопасность

### HTTPS обязателен

**Критически важно:** Всегда используйте HTTPS при работе с API ключами. Использование HTTP может привести к перехвату ключа злоумышленниками.

### Хранение ключей

- **Не храните ключи в коде** — используйте переменные окружения
- **Не коммитьте ключи в Git** — добавьте `.env` в `.gitignore`
- **Используйте разные ключи** для разных окружений (development, staging, production)
- **Регулярно ротируйте ключи** — создавайте новые и удаляйте старые

### Пример настройки в проекте

В проекте Track_parser ключи хранятся в переменных окружения:

```env
# .env
STREAMING_CENTER_API_URL=https://your-server.streaming.center:1030
STREAMING_CENTER_API_KEY=your_api_key_here
```

Использование в коде:

```typescript
// lib/radio/streamingCenterClient.ts
const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
const apiKey = process.env.STREAMING_CENTER_API_KEY || "";

const res = await fetch(url, {
  headers: { "SC-API-KEY": apiKey },
});
```

## Обработка ошибок аутентификации

При неправильном или отсутствующем API ключе API вернет ошибку:

- **401 Unauthorized** — неверный или отсутствующий API ключ
- **403 Forbidden** — ключ валиден, но недостаточно прав доступа

### Пример обработки ошибок

```typescript
const response = await fetch(url, {
  headers: { "SC-API-KEY": apiKey },
});

if (response.status === 401) {
  throw new Error("Invalid API key. Check STREAMING_CENTER_API_KEY.");
}

if (response.status === 403) {
  throw new Error("API key does not have required permissions.");
}

if (!response.ok) {
  throw new Error(`API error: ${response.status} ${response.statusText}`);
}
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Playlists API](./04-playlists.md) — примеры использования аутентификации
