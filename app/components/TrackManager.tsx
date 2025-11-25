"use client";

import { useState } from "react";

interface TrackStats {
  total: number;
  downloaded: number;
  processed: number;
  trimmed: number;
  rejected: number;
}

export default function TrackManager() {
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/cleanup-tracks");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setMessage("Статистика загружена");
      } else {
        setMessage("Ошибка загрузки статистики");
      }
    } catch (error) {
      setMessage("Ошибка загрузки статистики");
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupTracks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/cleanup-tracks", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.statsAfter);
        setMessage("Статусы треков очищены успешно");
      } else {
        setMessage("Ошибка очистки статусов");
      }
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
