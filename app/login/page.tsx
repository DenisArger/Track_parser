"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 card">
      <h2 className="text-xl font-semibold mb-4">Вход</h2>
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
            className="input"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg p-2">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        <Link href="/signup" className="text-primary-600 hover:underline">
          Регистрация
        </Link>
        {" · "}
        <Link href="/forgot-password" className="text-primary-600 hover:underline">
          Забыли пароль?
        </Link>
      </p>
      <p className="mt-2 text-xs text-gray-500">
        После регистрации подтвердите email по ссылке из письма, затем войдите.
      </p>
    </div>
  );
}
