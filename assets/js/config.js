/* Единственный файл, который нужно править при подключении бэкенда.

   1) Автономный режим: пусто — аккаунты и записи живут в localStorage.

   2) Общая статистика на Supabase (подключено):
      ключ anon публичный по дизайну Supabase — доступ ограничивают
      правила RLS из supabase/schema.sql (чтение и вставка разрешены,
      изменение и удаление — нет).
      ВАЖНО: здесь допустим только anon-ключ. service_role даёт полный
      доступ к базе и в клиентском коде недопустим.

   3) Свой сервер (server.py):
      window.POE2_CONFIG = { apiBase: "http://127.0.0.1:8000/api" };
*/
window.POE2_CONFIG = {
  apiBase: "",
  supabase: {
    url: "https://lsufcswjucjqhtszsjgu.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdWZjc3dqdWNqcWh0c3pzamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjExMDMsImV4cCI6MjEwODk5NzEwM30.ZaGXXIRXmancyZcXLK90B3k6XIeGk5lThggefDNsMfU"
  }
};
