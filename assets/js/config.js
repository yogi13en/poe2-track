/* Единственный файл, который нужно править при подключении бэкенда.

   1) Автономный режим (по умолчанию): пусто — аккаунты и записи живут
      в localStorage браузера, статистика только ваша.

   2) Общая статистика на Supabase (рекомендуется):
      window.POE2_CONFIG = {
        supabase: {
          url: "https://xxxxxxxx.supabase.co",
          anonKey: "eyJhbGciOi..."
        }
      };
      Ключ anon публичный по дизайну Supabase — он защищён правилами
      RLS: читать и добавлять можно, править и удалять нельзя.
      Схема таблицы: supabase/schema.sql.

   3) Свой сервер (server.py):
      window.POE2_CONFIG = { apiBase: "http://127.0.0.1:8000/api" };
*/
window.POE2_CONFIG = {
  apiBase: "",
  supabase: { url: "", anonKey: "" }
};
