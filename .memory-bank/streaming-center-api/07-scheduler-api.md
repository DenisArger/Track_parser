# Streaming.Center API - Scheduler API

## Обзор

Scheduler API позволяет управлять сеткой вещания (scheduling) — планировать запуск плейлистов в определенное время, управлять расписанием эфира и программировать вещание.

**Важно:** Streaming.Center поддерживает функции планирования вещания через scheduler, но точные endpoints могут отличаться в зависимости от версии панели управления. Рекомендуется проверять актуальную документацию в вашей панели управления.

## Основные возможности

Согласно документации Streaming.Center, платформа позволяет:

1. **Программировать вещание** — создавать расписание эфира
2. **Планировать запуск плейлистов** — запускать плейлисты в определенное время
3. **Управлять настройками scheduler** — настраивать параметры планирования
4. **Управлять джинглами и рекламой** — планировать воспроизведение с временными интервалами и датами начала/окончания

## Предполагаемые Endpoints

*Примечание: Точные endpoints могут отличаться. Проверьте документацию в вашей панели управления Streaming.Center.*

### Получение расписания

```
GET /api/v2/scheduler/
GET /api/v2/schedule/
GET /api/v1/scheduler/
```

### Создание/обновление расписания

```
POST /api/v2/scheduler/
PUT /api/v2/scheduler/{id}/
PATCH /api/v2/scheduler/{id}/
```

### Удаление расписания

```
DELETE /api/v2/scheduler/{id}/
```

## Планирование плейлиста

### Пример создания расписания для плейлиста

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

// Запустить плейлист в определенное время
const scheduleResponse = await fetch(`${apiUrl}/api/v2/scheduler/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    playlist_id: 1,
    start_time: "2024-01-22T10:00:00Z", // ISO 8601 формат
    end_time: "2024-01-22T12:00:00Z",   // Опционально
    server: 1,
    repeat: false, // Повторять ли ежедневно/еженедельно
  }),
});

const schedule = await scheduleResponse.json();
console.log("Created schedule:", schedule);
```

### Параметры расписания (предположительно)

| Параметр | Тип | Описание |
|----------|-----|----------|
| `playlist_id` | integer | ID плейлиста для запуска |
| `start_time` | string | Время начала (ISO 8601) |
| `end_time` | string | Время окончания (опционально) |
| `server` | integer | ID сервера |
| `repeat` | boolean | Повторять ли расписание |
| `repeat_type` | string | Тип повтора: "daily", "weekly", "monthly" |
| `days_of_week` | array | Дни недели для повтора (0-6, где 0 = воскресенье) |

## Планирование отдельного трека

### Пример запуска трека в определенное время

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

// Запустить конкретный трек в определенное время
const trackScheduleResponse = await fetch(`${apiUrl}/api/v2/scheduler/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    track_id: 123,
    start_time: "2024-01-22T14:30:00Z",
    server: 1,
  }),
});

const trackSchedule = await trackScheduleResponse.json();
```

## Получение текущего расписания

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

// Получить все расписания
const response = await fetch(`${apiUrl}/api/v2/scheduler/`, {
  headers: {
    "SC-API-KEY": apiKey,
  },
});

const schedules = await response.json();
console.log("Current schedules:", schedules);
```

### Фильтрация по дате

```typescript
// Получить расписание на определенную дату
const response = await fetch(
  `${apiUrl}/api/v2/scheduler/?date=2024-01-22`,
  {
    headers: {
      "SC-API-KEY": apiKey,
    },
  }
);

const schedules = await response.json();
```

## Управление джинглами и рекламой

Streaming.Center позволяет планировать воспроизведение джинглов и рекламы с временными интервалами:

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const apiKey = "your-api-key-here";

// Планировать джингл с интервалами
const jingleScheduleResponse = await fetch(`${apiUrl}/api/v2/scheduler/`, {
  method: "POST",
  headers: {
    "SC-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "jingle", // или "advertisement"
    file_id: 456,
    start_time: "2024-01-22T00:00:00Z",
    end_time: "2024-01-31T23:59:59Z",
    interval: 1800, // Интервал в секундах (30 минут)
    server: 1,
  }),
});
```

## Настройки плейлиста в scheduler

При работе с плейлистами через scheduler доступны дополнительные настройки:

- **"Start playlist again"** — опция, позволяющая запускать плейлист заново или продолжать с места остановки
- Для неслучайных плейлистов можно настроить продолжение воспроизведения с того места, где оно остановилось

## Примеры использования

### Создание ежедневного расписания

```typescript
async function createDailySchedule(
  playlistId: number,
  startTime: string, // "HH:MM" формат
  serverId: number = 1
) {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";

  // Получаем текущую дату и устанавливаем время
  const today = new Date();
  const [hours, minutes] = startTime.split(":");
  today.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  const response = await fetch(`${apiUrl}/api/v2/scheduler/`, {
    method: "POST",
    headers: {
      "SC-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playlist_id: playlistId,
      start_time: today.toISOString(),
      server: serverId,
      repeat: true,
      repeat_type: "daily",
    }),
  });

  return await response.json();
}

// Запускать плейлист каждый день в 10:00
await createDailySchedule(1, "10:00", 1);
```

### Получение расписания на сегодня

```typescript
async function getTodaySchedule(serverId: number = 1) {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const response = await fetch(
    `${apiUrl}/api/v2/scheduler/?date=${today}&server=${serverId}`,
    {
      headers: {
        "SC-API-KEY": apiKey,
      },
    }
  );

  return await response.json();
}
```

## Обработка ошибок

```typescript
try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "SC-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scheduleData),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API key");
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(`Invalid schedule data: ${error.message}`);
    }
    if (response.status === 404) {
      throw new Error("Scheduler endpoint not found. Check API version.");
    }
    throw new Error(`API error: ${response.status}`);
  }

  const schedule = await response.json();
  return schedule;
} catch (error) {
  console.error("Failed to create schedule:", error);
  throw error;
}
```

## Важные замечания

1. **Проверьте версию API** — Scheduler API может быть доступен в разных версиях (v1 или v2)
2. **Формат времени** — используйте ISO 8601 формат для дат и времени
3. **Часовой пояс** — убедитесь, что учитываете часовой пояс сервера
4. **Права доступа** — для создания расписания могут потребоваться дополнительные права API ключа

## Альтернативные подходы

Если Scheduler API недоступен через REST API, возможно:

1. Использование Admin Area API (v1) для управления расписанием
2. Использование веб-интерфейса панели управления для настройки расписания
3. Интеграция через другие endpoints, если они доступны в вашей версии

## Проверка доступности

Для проверки доступности Scheduler API в вашей версии:

```typescript
async function checkSchedulerAvailability() {
  const apiUrl = "https://your-server.streaming.center:1030";
  const apiKey = "your-api-key-here";

  // Пробуем разные возможные endpoints
  const endpoints = [
    "/api/v2/scheduler/",
    "/api/v2/schedule/",
    "/api/v1/scheduler/",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: { "SC-API-KEY": apiKey },
      });

      if (response.ok) {
        console.log(`Scheduler API available at: ${endpoint}`);
        return endpoint;
      }
    } catch (error) {
      // Продолжаем проверку
    }
  }

  throw new Error("Scheduler API not found. Check documentation.");
}
```

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md)
- [Playlists API](./04-playlists.md) — управление плейлистами для планирования
- [Admin Area API](./06-admin-api.md) — альтернативный способ управления

## Официальная документация

Для получения точной информации о Scheduler API:

1. Проверьте документацию в панели управления: **Settings → API Keys → Documentation**
2. Обратитесь к официальной документации: [streaming.center/docs/api](https://streaming.center/docs/api)
3. Свяжитесь с поддержкой Streaming.Center для уточнения endpoints
