# Track Parser - Radio Track Preparation Application

Полноценное веб-приложение для автоматизации подготовки аудиотреков для радио на базе Next.js с TypeScript.

## Возможности

- **Скачивание треков**: Поддержка YouTube (через RapidAPI) и Яндекс Музыки (через yt-dlp)
- **Прослушивание и отбор**: Встроенный аудиоплеер с кнопками принятия/отклонения
- **Автоматическое определение типа трека**: По длительности и BPM (Быстрый/Средний/Медленный)
- **Обрезка треков**: Автоматическая обрезка до 6 минут (требует FFmpeg)
- **Редактирование метаданных**: Полный редактор с тегированием
- **FTP загрузка**: Загрузка обработанных треков на сервер
- **Проверка «На радио»**: Сопоставление с плейлистом Streaming.Center (плейлист id=1), бейдж в списке треков
- **Прогресс-бары**: Отображение прогресса для всех операций
- **Организация файлов**: Автоматическое управление папками
- **✅ Полная поддержка Netlify**: Все функции работают с FFmpeg.wasm (WebAssembly версия FFmpeg)

## Требования

- Node.js 20+ (указано в package.json)
- Yarn 4.12.0+
- FFmpeg (для обработки аудио) - опционально, используется FFmpeg.wasm по умолчанию
- yt-dlp (для скачивания треков) - опционально, требуется только для YouTube Music и Яндекс.Музыки

**Платформы:** Windows, Linux, macOS (кроссплатформенная поддержка)

**Деплой:** ✅ Netlify, ✅ Vercel (с FFmpeg.wasm), VPS, выделенный сервер

**Обработка аудио:** Используется FFmpeg.wasm (WebAssembly) - работает везде, включая Netlify, без установки бинарных файлов

## Установка и настройка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd Track_parser
```

### 2. Установка зависимостей

```bash
yarn install
```

### 3. Настройка переменных окружения

Скопируйте файл `.env.example` в `.env` и заполните ваши API ключи:

```bash
cp .env.example .env
```

Отредактируйте `.env` файл:

```env
# RapidAPI Configuration
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=youtube-mp36.p.rapidapi.com

# FTP Configuration
FTP_HOST=s.ruworship.ru
FTP_PORT=21
FTP_USER=radio
FTP_PASSWORD=your_ftp_password_here
FTP_SECURE=false
FTP_REMOTE_PATH=/media/Server_1/0 0 ALL_TRACK  # Optional: remote directory on FTP server

# FFmpeg Configuration (optional)
# FFMPEG_PATH=C:\ffmpeg\bin

# Streaming.Center (проверка «трек уже на радио», плейлист «все треки»)
STREAMING_CENTER_API_URL=https://your-server.streaming.center:1030
STREAMING_CENTER_API_KEY=your_api_key_here
# STREAMING_CENTER_PLAYLIST_ID=1
```

**Streaming.Center (опционально):** для проверки «трек уже на радио» в плейлисте укажите:
- `STREAMING_CENTER_API_URL` — базовый URL (например `https://your-server.streaming.center:1030`)
- `STREAMING_CENTER_API_KEY` — ключ API
- `STREAMING_CENTER_PLAYLIST_ID` — ID плейлиста со всеми треками (по умолчанию 1)

Без этих переменных проверка отключена, бейдж «На радио» не показывается.

**Важно:** 
- Получите ваш RapidAPI ключ на [rapidapi.com](https://rapidapi.com/)
- Настройки FTP хранятся в `.env` для безопасности (пароль не должен попадать в репозиторий)

### 4. Установка FFmpeg и yt-dlp

#### Windows

1. **FFmpeg:**
   - Скачайте FFmpeg с [официального сайта](https://ffmpeg.org/download.html)
   - Распакуйте в `C:\ffmpeg\` или добавьте в PATH
   - Или укажите путь в `config.json` или переменной окружения `FFMPEG_PATH`

2. **yt-dlp:**
   - Скачайте `yt-dlp.exe` и поместите в папку `bin/` проекта

#### Linux

1. **FFmpeg:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install ffmpeg

   # Или укажите путь в config.json или переменной окружения FFMPEG_PATH
   ```

2. **yt-dlp:**
   ```bash
   # Установка через pip (рекомендуется)
   pip install yt-dlp

   # Или скачайте бинарник и поместите в папку bin/ проекта
   wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O bin/yt-dlp
   chmod +x bin/yt-dlp
   ```

#### Настройка пути к FFmpeg (опционально)

Вы можете указать путь к FFmpeg одним из способов:

1. **Через переменную окружения:**
   ```bash
   export FFMPEG_PATH=/usr/bin  # Linux
   # или
   set FFMPEG_PATH=C:\ffmpeg\bin  # Windows
   ```

2. **Через config.json:**
   ```json
   {
     "ffmpeg": {
       "path": "/usr/bin"  // Linux или "C:\\ffmpeg\\bin" для Windows
     }
   }
   ```

### 5. Проверка FFmpeg

```bash
yarn check
```

### 6. Запуск приложения

```bash
yarn dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Структура проекта

```
track-parser/
├── app/
│   ├── api/                    # API маршруты
│   │   ├── audio/[trackId]/    # Служение аудиофайлов
│   │   ├── download/           # Скачивание треков
│   │   ├── process-track/      # Обработка треков
│   │   ├── reject-track/       # Отклонение треков
│   │   ├── test-ftp/           # Тест FTP соединения
│   │   ├── tracks/             # Получение списка треков
│   │   ├── update-metadata/    # Обновление метаданных
│   │   └── upload-ftp/         # Загрузка на FTP
│   ├── components/             # React компоненты
│   │   ├── DownloadTrack.tsx   # Компонент скачивания
│   │   ├── TrackPlayer.tsx     # Аудиоплеер
│   │   ├── MetadataEditor.tsx  # Редактор метаданных
│   │   └── FtpUploader.tsx     # FTP загрузчик
│   ├── globals.css             # Глобальные стили
│   ├── layout.tsx              # Корневой layout
│   └── page.tsx                # Главная страница
├── lib/                        # Библиотечные функции
│   ├── config.ts               # Управление конфигурацией
│   └── processTracks.ts        # Логика обработки треков
├── types/                      # TypeScript типы
│   └── track.ts                # Типы для треков
├── config.json                 # Конфигурация приложения
├── next.config.js              # Конфигурация Next.js
├── package.json                # Зависимости
├── postcss.config.js           # Конфигурация PostCSS
├── tailwind.config.js          # Конфигурация Tailwind CSS
├── tsconfig.json               # Конфигурация TypeScript
└── README.md                   # Документация
```

## Использование

### 1. Скачивание треков

1. Перейдите на вкладку "Download Tracks"
2. Выберите источник (YouTube или Yandex Music)
3. Введите URL трека
4. Нажмите "Download Track"
5. Отслеживайте прогресс скачивания

### 2. Прослушивание и отбор

1. Перейдите на вкладку "Listen & Review"
2. Выберите трек из списка скачанных
3. Используйте аудиоплеер для прослушивания
4. Нажмите "Accept Track" или "Reject Track"

### 3. Редактирование метаданных

1. Перейдите на вкладку "Edit Metadata"
2. Выберите обработанный трек
3. Отредактируйте метаданные:
   - Название
   - Артист
   - Альбом
   - Тип трека (Быстрый/Средний/Медленный)
   - Рейтинг (1-10)
   - Год
4. Нажмите "Save Metadata"

### 4. Загрузка на FTP

1. Перейдите на вкладку "FTP Upload"
2. Настройте FTP параметры:
   - Host
   - Port
   - Username
   - Password
   - Secure connection (опционально)
3. Нажмите "Test Connection" для проверки
4. Выберите треки для загрузки или нажмите "Upload All Tracks"

## Организация файлов

Приложение автоматически создает и управляет следующими папками:

- `downloads/` - Скачанные треки
- `processed/` - Обработанные треки
- `rejected/` - Отклоненные треки
- `server_upload/` - Треки для загрузки на сервер

## API Endpoints

- `GET /api/tracks` - Получение списка треков
- `POST /api/download` - Скачивание трека
- `POST /api/process-track` - Обработка трека
- `POST /api/reject-track` - Отклонение трека
- `POST /api/update-metadata` - Обновление метаданных
- `POST /api/upload-ftp` - Загрузка на FTP
- `POST /api/test-ftp` - Тест FTP соединения
- `POST /api/radio/check-batch` - Проверка, какие треки уже есть в плейлисте Streaming.Center
- `GET /api/audio/[trackId]` - Получение аудиофайла

## Технологии

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Audio Processing**: FFmpeg, fluent-ffmpeg
- **Download**: ytdl-core
- **FTP**: basic-ftp
- **File Management**: fs-extra
- **Audio Metadata**: node-audiotags

## Разработка

### Команды

```bash
yarn dev          # Запуск в режиме разработки
yarn build        # Сборка для продакшена
yarn start        # Запуск продакшен версии
yarn lint         # Проверка кода
```

### Переменные окружения

Создайте файл `.env.local` для локальных настроек:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Деплой

### Деплой на Vercel

✅ **Проект поддерживает деплой на [Vercel](https://vercel.com).**

1. Подключите репозиторий к Vercel.
2. Добавьте переменные окружения (Supabase, RapidAPI, FTP) — см. [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md).
3. Деплой выполняется автоматически при `git push`.

Ограничения те же, что и на Netlify: yt-dlp недоступен, обработка через FFmpeg.wasm.

### Деплой в Netlify

✅ **Проект полностью поддерживает деплой в Netlify!**

Проект был переработан для полной поддержки Netlify с graceful degradation - все функции работают, но обработка аудио выполняется только при наличии FFmpeg.

### ✅ Что работает в Netlify

1. **Скачивание через RapidAPI:**
   - ✅ Скачивание треков с YouTube (обычный YouTube, не Music)
   - ✅ Получение метаданных
   - ✅ Прослушивание треков

2. **Веб-интерфейс:**
   - ✅ Все UI компоненты
   - ✅ Редактирование метаданных
   - ✅ Просмотр списка треков

3. **Обработка треков (с graceful degradation):**
   - ✅ Функция обработки работает без ошибок
   - ⚠️ Обрезка не выполняется (файл копируется без изменений)
   - ⚠️ BPM не определяется
   - ✅ Настройки обрезки сохраняются в метаданных

### ⚠️ Ограничения в Netlify

1. **yt-dlp:**
   - ❌ Нельзя запускать бинарные файлы в serverless
   - ❌ YouTube Music и Яндекс.Музыка недоступны
   - ✅ Обычный YouTube работает через RapidAPI

2. **Обработка аудио:**
   - ⚠️ Обрезка треков не выполняется (требует FFmpeg)
   - ⚠️ Fade in/out не применяется (требует FFmpeg)
   - ⚠️ Определение BPM не работает (требует FFmpeg)
   - ✅ Функции не падают с ошибками, работают gracefully

**Подробнее:** См. [NETLIFY_LIMITATIONS.md](./NETLIFY_LIMITATIONS.md)

### Настройка для Netlify

1. **Переменные окружения в Netlify:**
   - `RAPIDAPI_KEY` - ваш ключ RapidAPI
   - `RAPIDAPI_HOST` - хост RapidAPI (обычно `youtube-mp36.p.rapidapi.com`)

2. **Конфигурация уже настроена:**
   - Файл `netlify.toml` уже содержит необходимые настройки
   - Next.js плагин для Netlify установлен

3. **Деплой:**
   ```bash
   # Подключите репозиторий к Netlify
   # Netlify автоматически соберет проект при push в main ветку
   ```

### Рекомендации для Netlify

**Проект готов для деплоя в Netlify:**
- ✅ Все функции работают без ошибок
- ✅ Скачивание через RapidAPI работает
- ✅ Редактирование метаданных работает полностью
- ⚠️ Обработка аудио работает с graceful degradation (без обработки, но без ошибок)

**Для полной функциональности (обработка аудио):**
- ✅ Используйте VPS или выделенный сервер
- ✅ Установите FFmpeg и yt-dlp на сервере
- ✅ Деплойте Next.js приложение на сервер
- ✅ Все функции будут работать полностью

**Бинарники в `bin/`:**
- ✅ Полезны для локальной разработки (полная функциональность)
- ✅ Полезны для деплоя на VPS/сервер (полная функциональность)
- ⚠️ Не используются в Netlify (но проект работает gracefully)

## Устранение неполадок

### Проблемы с FFmpeg

1. **Windows:**
   - Убедитесь, что FFmpeg установлен и доступен в PATH
   - Проверьте версию: `ffmpeg -version`
   - Или укажите путь через `FFMPEG_PATH` или `config.json`

2. **Linux:**
   - Установите через пакетный менеджер: `sudo apt-get install ffmpeg`
   - Проверьте версию: `ffmpeg -version`
   - Если установлен в нестандартном месте, укажите путь через `FFMPEG_PATH`

3. **Путь не найден:**
   - Проверьте, что путь указывает на директорию с `ffmpeg` и `ffprobe`
   - На Windows: `C:\ffmpeg\bin\` (должны быть `ffmpeg.exe` и `ffprobe.exe`)
   - На Linux: `/usr/bin/` (должны быть `ffmpeg` и `ffprobe`)

### Проблемы с yt-dlp

1. **Windows:**
   - Убедитесь, что `yt-dlp.exe` находится в папке `bin/` проекта

2. **Linux:**
   - Установите через pip: `pip install yt-dlp`
   - Или скачайте бинарник в папку `bin/` и сделайте исполняемым: `chmod +x bin/yt-dlp`
   - Проверьте: `yt-dlp --version`

### Проблемы с YouTube

1. **RapidAPI не работает:**
   - Проверьте правильность API ключа
   - Убедитесь, что у вас есть активная подписка на RapidAPI
   - Приложение автоматически попробует yt-dlp как fallback

2. **yt-dlp не работает:**
   - Убедитесь, что yt-dlp установлен и доступен
   - Обновите yt-dlp: `pip install --upgrade yt-dlp` (Linux) или скачайте новую версию (Windows)
   - Проверьте, что FFmpeg установлен (требуется для конвертации в MP3)

### Проблемы с FTP

1. Проверьте правильность FTP настроек
2. Убедитесь, что сервер поддерживает выбранный тип соединения
3. Проверьте файрвол и настройки безопасности

### Проблемы с памятью

1. Для больших файлов увеличьте лимиты Node.js:
   ```bash
   node --max-old-space-size=4096 yarn dev
   ```

## Лицензия

MIT License

## Поддержка

При возникновении проблем создайте issue в репозитории проекта.
