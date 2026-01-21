"use client";

import { useState } from "react";

interface TrackStats {
  total: number;
  downloaded: number;
  processed: number;
  trimmed: number;
  rejected: number;
}

interface TrackManagerProps {
  onTracksUpdate?: () => void;
}

export default function TrackManager({ onTracksUpdate }: TrackManagerProps) {
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const { getTrackStatsAction } = await import(
        "@/lib/actions/trackActions"
      );
      const statsData = await getTrackStatsAction();
      setStats(statsData);
      setMessage("Статистика загружена");
    } catch (error) {
      setMessage("Ошибка загрузки статистики");
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupTracks = async () => {
    setIsLoading(true);
    try {
      const { cleanupTracksAction } = await import(
        "@/lib/actions/trackActions"
      );
      const data = await cleanupTracksAction();
      setStats(data.statsAfter);
      setMessage("Статусы треков очищены успешно");
    } catch (error) {
      setMessage("Ошибка очистки статусов");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Управление треками</h2>
        <p className="text-gray-600 mb-6">
          Просмотр статистики и очистка неправильных статусов треков.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Статистика */}
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Статистика треков</h3>

          {stats ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Всего треков:</span>
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Скачано:</span>
                <span className="font-medium">{stats.downloaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Обработано:</span>
                <span className="font-medium">{stats.processed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Обрезано:</span>
                <span className="font-medium text-blue-600">
                  {stats.trimmed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Отклонено:</span>
                <span className="font-medium text-red-600">
                  {stats.rejected}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              Нажмите "Загрузить статистику" для просмотра
            </p>
          )}

          <button
            onClick={loadStats}
            disabled={isLoading}
            className="btn btn-primary mt-4 w-full disabled:opacity-50"
          >
            {isLoading ? "Загрузка..." : "Загрузить статистику"}
          </button>
        </div>

        {/* Очистка статусов */}
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Очистка статусов</h3>
          <p className="text-sm text-gray-600 mb-4">
            Исправляет неправильно помеченные треки. Убирает флаг "Обрезан" у
            треков, которые не были действительно обрезаны.
          </p>

          <button
            onClick={cleanupTracks}
            disabled={isLoading}
            className="btn btn-secondary w-full disabled:opacity-50"
          >
            {isLoading ? "Очистка..." : "Очистить статусы"}
          </button>
        </div>

        {/* Начать с нуля */}
        <div className="card border-amber-200 bg-amber-50/50">
          <h3 className="text-lg font-medium mb-4">Начать с нуля</h3>
          <p className="text-sm text-gray-600 mb-4">
            Удалит все треки из базы и все файлы в хранилище (downloads, processed, rejected, previews). Действие необратимо.
          </p>

          <button
            onClick={async () => {
              if (
                !window.confirm(
                  "Все треки и все файлы в хранилище будут удалены. Продолжить?"
                )
              ) {
                return;
              }
              setIsLoading(true);
              try {
                const { resetAllDataAction } = await import(
                  "@/lib/actions/trackActions"
                );
                const res = await resetAllDataAction();
                if (res.ok) {
                  setMessage(
                    `Готово: удалено треков ${res.deleted}, очищено файлов в бакетах: ${JSON.stringify(res.cleared)}`
                  );
                  setStats(null);
                  onTracksUpdate?.();
                } else {
                  setMessage(`Ошибка: ${res.error || "неизвестная"}`);
                }
              } catch (e) {
                setMessage(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className="btn w-full disabled:opacity-50 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? "Сброс..." : "Сбросить всё"}
          </button>
        </div>
      </div>

      {/* Сообщения */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.includes("Ошибка")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
