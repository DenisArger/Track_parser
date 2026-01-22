"use client";

import { useState } from "react";
import { TrimSettings } from "@/types/track";

interface TrimDetailsProps {
  trimSettings: TrimSettings;
  onClose: () => void;
}

export default function TrimDetails({
  trimSettings,
  onClose,
}: TrimDetailsProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = trimSettings.endTime
    ? trimSettings.endTime - trimSettings.startTime
    : trimSettings.maxDuration || 360;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Детали обрезки</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Время начала
              </label>
              <p className="text-lg font-mono dark:text-gray-200">
                {formatTime(trimSettings.startTime)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Время окончания
              </label>
              <p className="text-lg font-mono dark:text-gray-200">
                {trimSettings.endTime
                  ? formatTime(trimSettings.endTime)
                  : formatTime(
                      trimSettings.startTime + (trimSettings.maxDuration || 360)
                    )}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Общая длительность
            </label>
            <p className="text-lg font-mono dark:text-gray-200">{formatTime(totalDuration)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Затухание в начале
              </label>
              <p className="text-lg font-mono dark:text-gray-200">{trimSettings.fadeIn}s</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Затухание в конце
              </label>
              <p className="text-lg font-mono dark:text-gray-200">{trimSettings.fadeOut}s</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Визуализация</h4>
            <div className="relative h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              {/* Фоновая полоса */}
              <div className="absolute inset-0 bg-gray-300 dark:bg-gray-500"></div>

              {/* Обрезанный фрагмент */}
              <div
                className="absolute h-full bg-blue-500"
                style={{
                  left: `${
                    (trimSettings.startTime /
                      (trimSettings.startTime + totalDuration + 60)) *
                    100
                  }%`,
                  width: `${
                    (totalDuration /
                      (trimSettings.startTime + totalDuration + 60)) *
                    100
                  }%`,
                }}
              ></div>

              {/* Затухание в начале */}
              {trimSettings.fadeIn > 0 && (
                <div
                  className="absolute h-full bg-blue-400 opacity-60"
                  style={{
                    left: `${
                      (trimSettings.startTime /
                        (trimSettings.startTime + totalDuration + 60)) *
                      100
                    }%`,
                    width: `${
                      (trimSettings.fadeIn /
                        (trimSettings.startTime + totalDuration + 60)) *
                      100
                    }%`,
                  }}
                ></div>
              )}

              {/* Затухание в конце */}
              {trimSettings.fadeOut > 0 && (
                <div
                  className="absolute h-full bg-blue-400 opacity-60"
                  style={{
                    left: `${
                      ((trimSettings.startTime +
                        totalDuration -
                        trimSettings.fadeOut) /
                        (trimSettings.startTime + totalDuration + 60)) *
                      100
                    }%`,
                    width: `${
                      (trimSettings.fadeOut /
                        (trimSettings.startTime + totalDuration + 60)) *
                      100
                    }%`,
                  }}
                ></div>
              )}
            </div>

            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
              <span>0:00</span>
              <span>
                {formatTime(trimSettings.startTime + totalDuration + 60)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
