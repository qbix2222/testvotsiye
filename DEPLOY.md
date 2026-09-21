# Деплой (бесплатно + свой домен)

> Коротко: код живёт на GitHub, сайт — на **Vercel** (бесплатно). GitHub Pages **не подходит**:
> там только статика без серверных `/api/*`, а нам нужен сервер для прокси провайдеров
> и веб-поиска.

## Вариант 1. Vercel — рекомендуется (2 минуты)

1. Влей ветку `arena/01a0c360-testvotsiye` в `main` (через PR) — либо деплой прямо с ветки (шаг 4).
2. Зайди на [vercel.com](https://vercel.com) через GitHub-аккаунт.
3. Нажми кнопку в [README](./README.md) **Deploy with Vercel**  
   (или вручную: Add New → Project → Import `qbix2222/testvotsiye`).
4. Настройки импорта:
   - Framework Preset: **Next.js** (определится сам)
   - Branch: `main` (или `arena/01a0c360-testvotsiye` для теста)
   - Environment Variables: **можно пусто** — ключи провайдеров вводятся в браузере.
     Необязательно:
     - `CODE=твой-пароль` — пароль доступа к сайту (через запятую несколько)
     - `OPENAI_API_KEY=sk-...` — серверный ключ по умолчанию (необязательно)
5. **Deploy** → получишь `https://testvotsiye.vercel.app` (бесплатно, SSL включён).

### Свой домен бесплатно

1. В проекте Vercel: **Settings → Domains → Add** → введи свой домен.
2. У регистратора домена добавь записи, которые покажет Vercel:
   - обычно `A @ → 76.76.21.21` и `CNAME www → cname.vercel-dns.com`
3. SSL выпустится автоматически. Готово.

## Вариант 2. Cloudflare Pages (тоже бесплатно)

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Репозиторий `qbix2222/testvotsiye`, ветка `main`.
3. Build settings: Framework preset **Next.js** (команда `yarn mask && next build`
   подхватится из `package.json`: `yarn build`).
4. Custom domain: Pages → Custom domains → Setup (бесплатно, SSL авто).
5. Подробности: [docs/cloudflare-pages-en.md](./docs/cloudflare-pages-en.md).

## Вариант 3. Свой VPS / Docker

```bash
docker build -t testvotsiye .
docker run -d -p 3000:3000 -e CODE=твой-пароль testvotsiye
```

Домен + HTTPS — через Caddy/NGINX поверх (см. `docker-compose.yml`).

## Переменные окружения (все необязательные)

| Переменная       | Назначение                              |
| ---------------- | --------------------------------------- |
| `CODE`           | Пароль доступа (можно несколько через `,`) |
| `OPENAI_API_KEY` | Серверный ключ OpenAI по умолчанию      |
| `BASE_URL`       | Свой OpenAI-совместимый endpoint        |
| `PROXY_URL`      | HTTP-прокси для исходящих запросов      |
| `HIDE_USER_API_KEY` | `1` — запретить ввод своих ключей    |
| `CUSTOM_MODELS`  | `+model,-model` — вкл/выкл моделей      |

Полный список — в [.env.template](./.env.template).

## Проверка после деплоя

1. Открой сайт → Настройки → **«Свои провайдеры»** → добавь провайдера → «Загрузить модели».
2. В селекторе модели в чате выбери импортированную модель.
3. Настройки → **«Веб-поиск»** → «Проверить» (без ключей сработает DuckDuckGo/SearXNG).
4. Спроси модель что-нибудь свежее — она сама вызовет `web_search` 🔍.
5. В шапке чата видны токены и цена сессии (Настройки → «Экономия токенов»).

## Локальный запуск

```bash
yarn install
yarn mask
yarn dev   # http://localhost:3000
```
