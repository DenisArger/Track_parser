# Track Parser - Radio Track Preparation Application

Полноценное веб-приложение для автоматизации подготовки аудиотреков для радио на базе Next.js с TypeScript.

## Возможности

- **Скачивание треков**: Поддержка YouTube и Яндекс Музыки
- **Прослушивание и отбор**: Встроенный аудиоплеер с кнопками принятия/отклонения
- **Автоматическое определение типа трека**: По длительности (Быстрый/Средний/Медленный)
- **Обрезка треков**: Автоматическая обрезка до 6 минут
- **Редактирование метаданных**: Полный редактор с тегированием
- **FTP загрузка**: Загрузка обработанных треков на сервер
- **Прогресс-бары**: Отображение прогресса для всех операций
- **Организация файлов**: Автоматическое управление папками

## Требования

- Node.js 18+
- Yarn
- FFmpeg (для обработки аудио)

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
```

**Важно:** Получите ваш RapidAPI ключ на [rapidapi.com](https://rapidapi.com/)

### 4. Проверка FFmpeg

```bash
yarn check
```

### 5. Запуск приложения

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

## Устранение неполадок

### Проблемы с FFmpeg

1. Убедитесь, что FFmpeg установлен и доступен в PATH
2. Проверьте версию: `ffmpeg -version`

### Проблемы с YouTube

1. ytdl-core может требовать обновления при изменениях в YouTube
2. Попробуйте обновить зависимость: `yarn upgrade ytdl-core`

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
