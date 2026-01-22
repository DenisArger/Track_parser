# Streaming.Center API - Scheduler API

## Обзор

Streaming.Center поддерживает функции планирования вещания (scheduler) через веб-интерфейс панели управления. Платформа позволяет программировать вещание и планировать запуск плейлистов в определенное время.

**Важно:** Официальная публичная документация по Scheduler API endpoints отсутствует на сайте streaming.center/docs/api.

## Подтвержденные возможности платформы

Согласно общим описаниям платформы Streaming.Center:

1. **Планирование вещания** — функция scheduler доступна в панели управления
2. **Запуск плейлистов по расписанию** — можно настроить запуск плейлистов в определенное время
3. **Настройки scheduler для плейлистов** — включая опцию "Start playlist again" для неслучайных плейлистов

## Статус API документации

**Официальная документация по Scheduler API endpoints не найдена в публичных источниках.**

Документированные endpoints Streaming.Center API:
- ✅ `/api/v2/playlists/` — управление плейлистами
- ✅ `/api/v2/history/` — история воспроизведения
- ✅ `/api/v2/podcasts/` — управление подкастами
- ❓ Scheduler API endpoints — **не документированы публично**

## Как проверить доступность Scheduler API

### 1. Проверка в панели управления

1. Войдите в панель управления Streaming.Center
2. Перейдите в раздел **Settings → API Keys**
3. Проверьте доступную документацию API
4. Ищите разделы, связанные с "scheduler", "schedule", "planning"

### 2. Проверка через API

Попробуйте проверить возможные endpoints:

```typescript
async function checkSchedulerEndpoints() {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";

  // Возможные варианты endpoints
  const possibleEndpoints = [
    "/api/v2/scheduler/",
    "/api/v2/schedule/",
    "/api/v2/schedules/",
    "/api/v1/scheduler/",
    "/api/v2/playlists/{id}/schedule/",
  ];

  for (const endpoint of possibleEndpoints) {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: { "SC-API-KEY": apiKey },
      });

      if (response.ok) {
        console.log(`✅ Found: ${endpoint}`);
        const data = await response.json();
        console.log("Response:", data);
        return endpoint;
      } else if (response.status === 404) {
        console.log(`❌ Not found: ${endpoint}`);
      } else {
        console.log(`⚠️  ${endpoint}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${endpoint}:`, error);
    }
  }

  return null;
}
```

### 3. Проверка через Playlists API

Возможно, функции планирования интегрированы в Playlists API. Проверьте структуру ответа при получении плейлиста:

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

const response = await fetch(`${apiUrl}/api/v2/playlists/1/`, {
  headers: { "SC-API-KEY": apiKey },
});

const playlist = await response.json();
console.log("Playlist structure:", playlist);
// Проверьте, есть ли поля, связанные с расписанием:
// schedule, scheduled_time, scheduler_settings и т.д.
```

## Альтернативные способы управления расписанием

### 1. Через веб-интерфейс

Используйте панель управления Streaming.Center для настройки расписания:
- Войдите в панель управления
- Найдите раздел Scheduler или Schedule
- Настройте расписание через веб-интерфейс

### 2. Через Admin Area API (v1)

Возможно, функции планирования доступны через Admin Area API:

```typescript
// Аутентификация через v1 API
const loginResponse = await fetch(`${apiUrl}/api/v1/rest-auth/login/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});

const { key: authToken } = await loginResponse.json();

// Проверка endpoints в v1
const v1Endpoints = [
  "/api/v1/scheduler/",
  "/api/v1/schedule/",
  "/api/v1/broadcasters/{id}/schedule/",
];

for (const endpoint of v1Endpoints) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: { "Authorization": `Token ${authToken}` },
  });
  // Проверка ответа...
}
```

## Рекомендации

1. **Обратитесь к поддержке Streaming.Center** — запросите документацию по Scheduler API
2. **Проверьте панель управления** — возможно, документация доступна только авторизованным пользователям
3. **Используйте веб-интерфейс** — для настройки расписания, если API недоступен
4. **Изучите структуру ответов** — проверьте, есть ли информация о расписании в ответах других endpoints

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [Playlists API](./04-playlists.md) — возможно, содержит информацию о расписании
- [Admin Area API](./06-admin-api.md) — альтернативный способ доступа

## Обновление документации

Если вы найдете официальную документацию по Scheduler API или рабочие endpoints, пожалуйста, обновите этот файл с подтвержденной информацией.
