export default function LocaleLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-5xl space-y-4">
        <div className="h-10 w-40 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 rounded-xl bg-white dark:bg-gray-800 shadow-md animate-pulse" />
          <div className="h-56 rounded-xl bg-white dark:bg-gray-800 shadow-md animate-pulse" />
        </div>
        <div className="h-96 rounded-xl bg-white dark:bg-gray-800 shadow-md animate-pulse" />
      </div>
    </div>
  );
}
