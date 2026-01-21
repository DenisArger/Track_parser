"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setMessage(
        "На вашу почту отправлено письмо со ссылкой для подтверждения. Перейдите по ссылке, затем войдите. Проверьте также папку «Спам»."
      );
    } catch {
      setError("Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 card">
      <h2 className="text-xl font-semibold mb-4">Регистрация</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="input"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Подтвердите пароль
          </label>
          <input
            id="confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="input"
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-2">
            {error}
          </div>
        )}
        {message && (
          <div className="text-sm text-success-700 bg-success-50 border border-success-200 rounded-lg p-2">
            {message}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Регистрация…" : "Зарегистрироваться"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        <Link href="/login" className="text-primary-600 hover:underline">
          Уже есть аккаунт — войти
        </Link>
      </p>
    </div>
  );
}
