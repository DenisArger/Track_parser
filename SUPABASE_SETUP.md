# Настройка Supabase для Track Parser

Это руководство поможет вам настроить Supabase для работы приложения Track Parser.

## Шаг 1: Создание проекта Supabase

1. Перейдите на [supabase.com](https://supabase.com) и войдите в аккаунт
2. Создайте новый проект
3. Запишите следующие данные из настроек проекта:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon/public key** (находится в Settings > API)
   - **service_role key** (находится в Settings > API, **НЕ ПУБЛИКУЙТЕ ЕГО!**)

## Шаг 2: Настройка базы данных

1. В Supabase Dashboard перейдите в **SQL Editor**
2. Откройте файл `supabase/migrations/001_create_tracks_table.sql`
3. Скопируйте содержимое и выполните в SQL Editor
4. Убедитесь, что таблица `tracks` создана успешно

## Шаг 2.1: Таблица users и авторизация

1. **Миграция 002 — таблица `public.users`**  
   В SQL Editor выполните содержимое `supabase/migrations/002_create_users_table.sql`.  
   Таблица `users` дополняет `auth.users` (id, email, created_at, updated_at). Триггер при INSERT в `auth.users` создаёт запись в `public.users`. RLS разрешает пользователю только чтение и обновление своей строки.

2. **Бэкфилл (если в `auth.users` уже есть пользователи):**
   ```sql
   INSERT INTO public.users (id, email) SELECT id, email FROM auth.users ON CONFLICT (id) DO NOTHING;
   ```

3. **Authentication → Providers → Email:**  
   Включите **Email**. Оставьте включённым **Confirm email** — после регистрации пользователь получает письмо со ссылкой; перейдя по ней, он попадает в приложение уже авторизованным.

4. **URL Configuration (Authentication):**  
   - **Site URL:** `http://localhost:3000` (dev) или `https://<ваш-домен>` (prod)  
   - **Redirect URLs** (обязательно для писем подтверждения и сброса пароля):  
     `http://localhost:3000/auth/callback`  
     `https://<ваш-домен>/auth/callback`

При регистрации приложение передаёт `emailRedirectTo=/auth/callback` — ссылка из письма ведёт на этот маршрут, где обменивается `code` на сессию и выполняется редирект на главную.

После этого вход и регистрация (с подтверждением по почте) работают по email и паролю. Подробнее: [Supabase Auth](https://supabase.com/docs/guides/auth).

## Шаг 3: Настройка Storage

1. В Supabase Dashboard перейдите в **Storage**
2. Создайте следующие bucket'ы:

   - **downloads** (Public)
   - **processed** (Public)
   - **rejected** (Private)
   - **server-upload** (Private)
   - **previews** (Public)

3. Для каждого bucket настройте политики доступа:
   - **Public bucket'ы** (downloads, processed, previews): разрешите чтение для всех
   - **Private bucket'ы** (rejected, server-upload): используйте service role key для доступа

## Шаг 4: Включение Realtime

1. В Supabase Dashboard перейдите в **Database > Replication**
2. Найдите таблицу `tracks` и включите Realtime для неё
3. Это позволит получать обновления в реальном времени

## Шаг 5: Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# RapidAPI Configuration (существующие настройки)
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=youtube-mp36.p.rapidapi.com

# FTP Configuration (существующие настройки)
FTP_HOST=s.ruworship.ru
FTP_PORT=21
FTP_USER=radio
FTP_PASSWORD=your_ftp_password_here
FTP_SECURE=false
FTP_REMOTE_PATH=/media/Server_1/0 0 ALL_TRACK
```

## Шаг 6: Установка зависимостей

```bash
yarn install
```

Это установит `@supabase/supabase-js`, который был добавлен в `package.json`.

## Шаг 7: Установка зависимостей для скриптов миграции

```bash
yarn install
```

Это установит `tsx`, который используется для запуска скриптов миграции.

## Шаг 8: Миграция существующих данных (опционально)

Если у вас есть существующие данные в `tracks.json`:

```bash
# Убедитесь, что переменные окружения установлены в .env.local
# Затем запустите миграцию
yarn migrate:tracks
```

Или напрямую:
```bash
yarn tsx scripts/migrate-tracks-to-supabase.ts
```

## Шаг 9: Миграция существующих файлов (опционально)

Если у вас есть существующие аудио файлы в папках `downloads/`, `processed/`, `rejected/`:

```bash
yarn migrate:files
```

Или напрямую:
```bash
yarn tsx scripts/migrate-files-to-storage.ts
```

**Внимание:** Скрипт по умолчанию НЕ удаляет локальные файлы после миграции. Раскомментируйте строку удаления в скрипте, если хотите удалить файлы после успешной миграции.

## Шаг 10: Запуск приложения

```bash
yarn dev
```

Приложение должно работать с Supabase!

## Проверка работы

1. Откройте приложение в браузере — при необходимости вы будете перенаправлены на `/login`.
2. Войдите или зарегистрируйтесь (email + пароль), затем откройте главную страницу.
3. Попробуйте скачать трек — он должен загрузиться в Supabase Storage.
4. Проверьте Supabase Dashboard:
   - В таблице `tracks` должны появиться записи
   - В Storage bucket `downloads` должны появиться файлы
   - В таблице `users` — записи о вошедших пользователях (после регистрации)

## Устранение проблем

### Ошибка `getaddrinfo ENOTFOUND your-project.supabase.co`
- В `.env` или `.env.local` остался плейсхолдер `your-project.supabase.co`
- Замените `NEXT_PUBLIC_SUPABASE_URL` на ваш **Project URL** из Supabase: Dashboard → Settings → API
- Формат: `https://<ваш-project-id>.supabase.co`
- То же для `NEXT_PUBLIC_SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY`
- Перезапустите dev-сервер после правок

### Ошибка "Missing Supabase environment variables"
- Убедитесь, что файл `.env.local` создан и содержит все необходимые переменные
- Перезапустите сервер разработки после изменения `.env.local`

### Ошибка при создании таблицы
- Убедитесь, что вы используете правильный SQL из файла миграции
- Проверьте, что у вас есть права на создание таблиц в базе данных

### Файлы не загружаются в Storage
- Проверьте, что bucket'ы созданы и имеют правильные настройки доступа
- Убедитесь, что `SUPABASE_SERVICE_ROLE_KEY` правильный

### Realtime не работает
- Убедитесь, что Realtime включен для таблицы `tracks` в Dashboard
- Проверьте консоль браузера на наличие ошибок подключения

## Дополнительная информация

- [Документация Supabase](https://supabase.com/docs)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
