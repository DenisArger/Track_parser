# Деплой на Vercel

Проект поддерживает деплой на [Vercel](https://vercel.com). Vercel автоматически определяет Next.js и собирает приложение.

## Быстрый старт

### 1. Подключение репозитория

1. Зайдите на [vercel.com](https://vercel.com) и войдите (через GitHub/GitLab/Bitbucket).
2. Нажмите **Add New** → **Project**.
3. Импортируйте репозиторий Track_parser.
4. Vercel определит Next.js по `package.json` и `vercel.json`.

### 2. Переменные окружения

В настройках проекта **Settings → Environment Variables** добавьте:

#### Supabase (обязательно)

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL из Supabase Dashboard (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public ключ из Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ (для серверных операций со Storage и БД) |

#### RapidAPI (для скачивания с YouTube)

| Переменная | Описание |
|------------|----------|
| `RAPIDAPI_KEY` | Ключ с [rapidapi.com](https://rapidapi.com) |
| `RAPIDAPI_HOST` | `youtube-mp36.p.rapidapi.com` |

#### FTP (для загрузки обработанных треков)

| Переменная | Описание |
|------------|----------|
| `FTP_HOST` | Хост FTP-сервера |
| `FTP_PORT` | Порт (обычно 21) |
| `FTP_USER` | Логин |
| `FTP_PASSWORD` | Пароль |
| `FTP_SECURE` | `true` или `false` |
| `FTP_REMOTE_PATH` | Удалённая папка (необязательно) |

### 3. Деплой

- **Автодеплой:** при каждом `git push` в подключённую ветку Vercel собирает и публикует новый деплой.
- **Ручной деплой:** в корне проекта:
  ```bash
  npx vercel
  ```
  или установите Vercel CLI: `yarn add -g vercel`.

## Конфигурация

- `vercel.json` — сборка через `yarn build`, фреймворк Next.js.
- Node.js берётся из `package.json` → `engines.node` (>=20.9.0).

## Ограничения на Vercel (serverless)

Как и на Netlify, в serverless-среде:

- **yt-dlp** — недоступен (нет бинарников). Работает только скачивание YouTube через RapidAPI.
- **Обработка аудио** — используется FFmpeg.wasm: обрезка и BPM работают в браузере/функциях. Нативного FFmpeg на Vercel нет.
- **Файловая система** — только `/tmp`; постоянное хранилище — Supabase Storage.

Приложение определяет Vercel через `VERCEL=1` и `VERCEL_URL` и переключается на serverless-режим (то же поведение, что и для Netlify).

## Полезные ссылки

- [Документация Vercel](https://vercel.com/docs)
- [Next.js на Vercel](https://vercel.com/docs/frameworks/nextjs)
