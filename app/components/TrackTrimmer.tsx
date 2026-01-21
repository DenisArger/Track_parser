"use client";

import { useState, useEffect, useRef } from "react";
import { Track, TrimSettings } from "@/types/track";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";

interface TrackTrimmerProps {
  track: Track;
  onCancel: () => void;
}

export default function TrackTrimmer({ track, onCancel }: TrackTrimmerProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | undefined>(undefined);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [maxDuration, setMaxDuration] = useState(360);
  const [useEndTime, setUseEndTime] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // Получаем длительность трека при загрузке
  useEffect(() => {
    const audio = new Audio(`/api/audio/${track.id}`);
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
      if (!endTime) {
        setEndTime(Math.min(audio.duration, maxDuration));
      }
    });
  }, [track.id, maxDuration]);

  // Автоматически обновляем предварительный просмотр при изменении настроек
  useEffect(() => {
    if (previewId) {
      const timeoutId = setTimeout(() => {
        updatePreview();
      }, 1000); // Задержка в 1 секунду после изменения настроек

      return () => clearTimeout(timeoutId);
    }
  }, [startTime, endTime, fadeIn, fadeOut, maxDuration, useEndTime]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTrim = async () => {
    const trimSettings: TrimSettings = {
      startTime,
      fadeIn,
      fadeOut,
      ...(useEndTime && endTime ? { endTime } : { maxDuration }),
    };

    try {
      const { trimTrackAction } = await import("@/lib/actions/trackActions");
      const result = await trimTrackAction(track.id, trimSettings);
      console.log("Track trimmed successfully:", result);

      // Закрываем окно обрезки
      onCancel();
    } catch (error) {
      console.error("Error trimming track:", error);
      alert(`Error trimming track: ${getUserFacingErrorMessage(error, "Unknown error")}`);
    }
  };

  const createPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const trimSettings: TrimSettings = {
        startTime,
        fadeIn,
        fadeOut,
        ...(useEndTime && endTime ? { endTime } : { maxDuration }),
      };

      const { createPreviewAction } = await import(
        "@/lib/actions/trackActions"
      );
      const result = await createPreviewAction(track.id, trimSettings);
      setPreviewId(result.previewId);
      console.log("Preview created:", result.previewId);
    } catch (error) {
      console.error("Error creating preview:", error);
      alert(`Error creating preview: ${getUserFacingErrorMessage(error, "Unknown error")}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewPlayPause = async () => {
    if (!previewId) {
      await createPreview();
      return;
    }

    if (previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
      } else {
        await previewAudioRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  const handlePreviewEnded = () => {
    setIsPreviewPlaying(false);
  };

  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current) {
      setPreviewCurrentTime(previewAudioRef.current.currentTime);
    }
  };

  const handlePreviewLoadedMetadata = () => {
    if (previewAudioRef.current) {
      setPreviewDuration(previewAudioRef.current.duration);
    }
  };

  const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = time;
      setPreviewCurrentTime(time);
    }
  };

  // Автоматически обновляем предварительный просмотр при изменении настроек
  const updatePreview = async () => {
    if (previewId) {
      setIsPreviewLoading(true);
      try {
        const trimSettings: TrimSettings = {
          startTime,
          fadeIn,
          fadeOut,
          ...(useEndTime && endTime ? { endTime } : { maxDuration }),
        };

        const { createPreviewAction } = await import(
          "@/lib/actions/trackActions"
        );
        const result = await createPreviewAction(track.id, trimSettings);
        setPreviewId(result.previewId);
        setPreviewCurrentTime(0);
        setIsPreviewPlaying(false);
        console.log("Preview updated:", result.previewId);
      } catch (error) {
        console.error("Error updating preview:", error);
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  const totalDuration =
    useEndTime && endTime ? endTime - startTime : maxDuration;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Настройки обрезки трека</h3>
        <p className="text-sm text-gray-600 mb-4">{track.metadata.title}</p>

        <div className="space-y-4">
          {/* Время начала */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Время начала
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max={duration}
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 min-w-[40px]">
                {formatTime(startTime)}
              </span>
            </div>
          </div>

          {/* Тип окончания */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип окончания
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useEndTime}
                  onChange={() => setUseEndTime(false)}
                  className="mr-2"
                />
                Максимальная длительность
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useEndTime}
                  onChange={() => setUseEndTime(true)}
                  className="mr-2"
                />
                Конкретное время
              </label>
            </div>
          </div>

          {/* Время окончания или максимальная длительность */}
          {useEndTime ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Время окончания
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min={startTime}
                  max={duration}
                  value={endTime || startTime}
                  onChange={(e) => setEndTime(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 min-w-[40px]">
                  {formatTime(endTime || startTime)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Максимальная длительность (секунды)
              </label>
              <input
                type="number"
                min="1"
                max="600"
                value={maxDuration}
                onChange={(e) => setMaxDuration(parseInt(e.target.value))}
                className="input"
              />
            </div>
          )}

          {/* Затухание в начале */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Затухание в начале (секунды)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={fadeIn}
              onChange={(e) => setFadeIn(parseFloat(e.target.value))}
              className="input"
            />
          </div>

          {/* Затухание в конце */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Затухание в конце (секунды)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={fadeOut}
              onChange={(e) => setFadeOut(parseFloat(e.target.value))}
              className="input"
            />
          </div>

          {/* Предварительный просмотр */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">
              Предварительный просмотр
            </h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Начало: {formatTime(startTime)}</p>
              <p>
                Окончание:{" "}
                {formatTime(
                  useEndTime && endTime ? endTime : startTime + maxDuration
                )}
              </p>
              <p>Длительность: {formatTime(totalDuration)}</p>
              <p>Затухание в начале: {fadeIn}s</p>
              <p>Затухание в конце: {fadeOut}s</p>
            </div>

            {/* Кнопка предварительного прослушивания */}
            <div className="mt-3">
              <button
                onClick={handlePreviewPlayPause}
                disabled={isPreviewLoading}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreviewLoading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Создание предварительного просмотра...
                  </div>
                ) : isPreviewPlaying ? (
                  "Остановить предварительное прослушивание"
                ) : (
                  "Предварительное прослушивание"
                )}
              </button>
            </div>

            {/* Плеер предварительного прослушивания */}
            {previewId && (
              <div className="mt-4 bg-white rounded-lg p-3 border">
                <h5 className="font-medium text-gray-900 mb-3">
                  Плеер предварительного просмотра
                </h5>

                {/* Элементы управления */}
                <div className="flex items-center space-x-3 mb-3">
                  <button
                    onClick={handlePreviewPlayPause}
                    className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700"
                  >
                    {isPreviewPlaying ? (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max={previewDuration || 0}
                      value={previewCurrentTime}
                      onChange={handlePreviewSeek}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <span className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(previewCurrentTime)} /{" "}
                    {formatTime(previewDuration)}
                  </span>
                </div>

                {/* Информация о настройках */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    Обрезанный фрагмент: {formatTime(startTime)} -{" "}
                    {formatTime(
                      useEndTime && endTime ? endTime : startTime + maxDuration
                    )}
                  </p>
                  <p>
                    Затухание в начале: {fadeIn}s | Затухание в конце: {fadeOut}
                    s
                  </p>
                </div>

                {/* Кнопка обновления предварительного просмотра */}
                <div className="mt-3">
                  <button
                    onClick={updatePreview}
                    disabled={isPreviewLoading}
                    className="btn btn-secondary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPreviewLoading
                      ? "Обновление..."
                      : "Обновить предварительный просмотр"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Скрытый аудио элемент для предварительного прослушивания */}
          {previewId && (
            <audio
              ref={previewAudioRef}
              src={`/api/preview-audio/${previewId}`}
              onTimeUpdate={handlePreviewTimeUpdate}
              onLoadedMetadata={handlePreviewLoadedMetadata}
              onEnded={handlePreviewEnded}
              onError={(error) => {
                console.error("Preview audio error:", error);
                alert("Ошибка воспроизведения предварительного просмотра");
              }}
            />
          )}
        </div>

        {/* Кнопки */}
        <div className="flex space-x-3 mt-6">
          <button onClick={handleTrim} className="btn btn-primary flex-1">
            Обрезать трек
          </button>
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
