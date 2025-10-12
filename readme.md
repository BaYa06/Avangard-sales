# Sales Board — Server (sql.js, без нативной сборки)

Работает на любой современный Node **без nvm**, **без Xcode**, потому что используется `sql.js` (WebAssembly) вместо native `better-sqlite3`.

## Запуск
```bash
npm install
npm start
# открыть http://localhost:3000
```

## Что внутри
- Сервер: **Express**.
- База: **SQLite через sql.js** (файл `data/sales.sqlite`). Сохранение на диск происходит после изменений.
- API совместим с прежним вариантом: `/api/managers`, `/api/events`, `/api/aggregates`, `/api/backup`, `/api/restore`, `/api/reset`.
- Фронтенд: адаптивный, таблица «Сегодня: по менеджерам» на дашборде.

## Примечание
`sql.js` держит БД в памяти процесса и пишет на диск при изменениях. Для небольшого числа запросов это отлично. Если будет высокая нагрузка/параллельность — лучше перейти на серверный SQLite (native) или Postgres.
