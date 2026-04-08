# Streaming.Center API - Admin Area API

## Обзор

Admin Area API (v1) предоставляет административные функции для управления broadcasters, resellers, templates и другими системными настройками.

## Базовый URL

```
<control-panel-address>/api/v1/
```

Где `<control-panel-address>` — адрес вашей панели управления Streaming.Center. На сайте в качестве примера указан формат вроде `https://stream.radio.com:2345`.

## Аутентификация

Admin Area API использует аутентификацию через токен, полученный через endpoint `/api/v1/rest-auth/login/`.

### Логин

```
POST /api/v1/rest-auth/login/
```

#### Параметры запроса

| Параметр | Тип | Описание | Обязательный |
|----------|-----|----------|--------------|
| `username` | string | Имя пользователя | Да |
| `password` | string | Пароль | Да |

#### Пример запроса (cURL)

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"username":"your_username","password":"your_password"}' \
     "https://your-server.streaming.center:1030/api/v1/rest-auth/login/"
```

#### Пример ответа

```json
{
  "key": "your-auth-token-here",
  "user": {}
}
```

### Использование токена

После получения токена, используйте его в заголовке `Authorization`:

```
Authorization: Token your-auth-token-here
```

В официальной документации показан именно вариант с `Authorization: Token <key>`.

## Endpoints

### Broadcasters

Управление вещателями (broadcasters).

#### Получение списка broadcasters

```
GET /api/v1/broadcasters/
```

#### Создание broadcaster

```
POST /api/v1/broadcasters/
```

#### Обновление broadcaster

```
PUT /api/v1/broadcasters/{id}/
PATCH /api/v1/broadcasters/{id}/
```

#### Удаление broadcaster

```
DELETE /api/v1/broadcasters/{id}/

На официальной странице отдельно указано, что `DELETE` помечает broadcaster как `BEING_DELETED`.
```

### Resellers

Управление реселлерами.

#### Получение списка resellers

```
GET /api/v1/resellers/
```

#### Создание reseller

```
POST /api/v1/resellers/
```

### Templates

Управление шаблонами.

#### Получение списка templates

```
GET /api/v1/templates/
```

#### Создание template

```
POST /api/v1/templates/
```

На сайте подробно перечислены и дополнительные пути для шаблонов:

- `/api/v1/templates/email/`
- `/api/v1/templates/email/types/`
- `/api/v1/templates/broadcasters/`
- `/api/v1/templates/resellers/`

## Примеры использования

### Аутентификация и получение списка broadcasters (TypeScript)

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const username = "your_username";
const password = "your_password";

// 1. Логин
const loginResponse = await fetch(`${apiUrl}/api/v1/rest-auth/login/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ username, password }),
});

if (!loginResponse.ok) {
  throw new Error("Login failed");
}

const { key: authToken } = await loginResponse.json();

// 2. Использование токена для запроса
const broadcastersResponse = await fetch(`${apiUrl}/api/v1/broadcasters/`, {
  headers: {
    "Authorization": `Token ${authToken}`,
  },
});

const broadcasters = await broadcastersResponse.json();
console.log(broadcasters);
```

### Пример запроса (cURL)

```bash
# 1. Логин
AUTH_TOKEN=$(curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' \
  "https://your-server.streaming.center:1030/api/v1/rest-auth/login/" \
  | jq -r '.key')

# 2. Получение списка broadcasters
curl -H "Authorization: Token $AUTH_TOKEN" \
     "https://your-server.streaming.center:1030/api/v1/broadcasters/"
```

### Создание broadcaster

```typescript
const apiUrl = "https://your-server.streaming.center:1030";
const authToken = "your-auth-token-here";

const response = await fetch(`${apiUrl}/api/v1/broadcasters/`, {
  method: "POST",
  headers: {
    "Authorization": `Token ${authToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "New Broadcaster",
    // другие параметры...
  }),
});

const broadcaster = await response.json();
```

## Структура данных

### Broadcaster

| Поле | Тип | Описание |
|------|-----|----------|
| `pk` | integer | Уникальный идентификатор |
| `name` | string | Название broadcaster |
| `created_at` | string | Дата создания |
| `updated_at` | string | Дата обновления |

### Reseller

| Поле | Тип | Описание |
|------|-----|----------|
| `pk` | integer | Уникальный идентификатор |
| `name` | string | Название reseller |
| `created_at` | string | Дата создания |

### Template

| Поле | Тип | Описание |
|------|-----|----------|
| `pk` | integer | Уникальный идентификатор |
| `name` | string | Название шаблона |
| `config` | object | Конфигурация шаблона |

## Обработка ошибок

```typescript
try {
  const response = await fetch(url, {
    headers: {
      "Authorization": `Token ${authToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication failed. Check username and password.");
    }
    if (response.status === 403) {
      throw new Error("Insufficient permissions.");
    }
    if (response.status === 404) {
      throw new Error("Resource not found.");
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error("Admin API error:", error);
  throw error;
}
```

## Различия между v1 и v2

| Аспект | v1 (Admin API) | v2 (Public API) |
|--------|----------------|-----------------|
| Аутентификация | Token через `/rest-auth/login/` | API ключ в заголовке `SC-API-KEY` |
| Использование | Административные функции | Публичные функции (плейлисты, история, подкасты) |

## Дополнения с официального сайта

На странице официальной документации также есть следующие важные детали, которые стоит учитывать при дальнейшем расширении этого файла:

- `GET /api/v1/broadcasters/{pk}/` для получения одной записи
- `GET /api/v1/resellers/{pk}/`, `PUT`, `PATCH`, `DELETE`
- `POST /api/v1/broadcasters/{pk}/download_backup/?t=<token>`
- `POST /api/v1/broadcasters/{pk}/backup/`
- `POST /api/v1/broadcasters/{pk}/suspend/` и `/unsuspend/`
- `POST /api/v1/broadcasters/{pk}/login/`
- `POST /api/v1/resellers/{pk}/login/`
- `GET/PUT /api/v1/license/`

## Рекомендации

1. **Используйте v2 API** для большинства задач (плейлисты, история, подкасты)
2. **Используйте v1 API** только для административных задач, недоступных в v2
3. **Храните токены безопасно** — не коммитьте их в код
4. **Используйте HTTPS** для всех запросов

## Связанные документы

- [Введение](./01-introduction.md)
- [Аутентификация](./02-authentication.md) — для v2 API
- [Playlists API](./04-playlists.md) — пример использования v2 API
