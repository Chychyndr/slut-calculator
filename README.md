# Калькулятор шалав

Псевдонаучный мем-калькулятор свидательной ауры. Пользователь выбирает режим, категории, отвечает на вопросы и получает процент с коротким разбором.

Проект специально сделан как статический сайт: без базы данных, backend и регистрации. Все ответы считаются прямо в браузере.

## Что есть

- 212 вопросов;
- режимы анкеты: смешанный, серьезный, мемный;
- выбор категорий: внешность, гигиена, общение, быт, игры, интернет и другие;
- один вопрос на экране;
- понятные подписи для шкалы 1-10;
- варианты ответа для вопросов да/нет: да, скорее да, возможно, не знаю, скорее нет, нет;
- досрочный подсчет по уже данным ответам;
- возможность продолжить тест после промежуточного результата;
- смешное звание выдается всегда, даже при досрочном подсчете;
- темная тема по умолчанию;
- защита внешнего вида от Dark Reader;
- нелинейная формула с весами, ограничителями и скрытыми комбинациями;
- готовый запуск через Vite;
- готовый запуск через Docker;
- готовый деплой на GitHub Pages через GitHub Actions.

## Description для GitHub

```text
Псевдонаучный мем-калькулятор свидательной ауры с категориями, вопросами и нелинейной формулой.
```

## Быстрый запуск без установки зависимостей

Нужен установленный Python. Через `uv` можно запустить так:

```bash
uv run --no-project python -m http.server 8000
```

Открой в браузере:

```text
http://localhost:8000
```

## Запуск как frontend-проекта

Нужен Node.js 20+.

```bash
npm install
npm run dev
```

Проверка синтаксиса:

```bash
npm run check
```

Сборка:

```bash
npm run build
```

Предпросмотр production-сборки:

```bash
npm run preview
```

После сборки готовые файлы будут в папке `dist/`.

## Запуск через Docker

Нужен Docker Desktop или обычный Docker Engine.

```bash
docker compose up --build
```

Открой:

```text
http://localhost:8080
```

Остановить:

```bash
docker compose down
```

Собрать образ вручную:

```bash
docker build -t slut-calculator .
docker run --rm -p 8080:80 slut-calculator
```

В Docker проект собирается через Vite, а готовая папка `dist/` раздается через Nginx.

## Деплой на GitHub Pages

Репозиторий лучше назвать так:

```text
slut-calculator
```

Тогда сайт будет доступен примерно по адресу:

```text
https://Chychyndr.github.io/slut-calculator/
```

Что сделать:

1. Создай публичный репозиторий `slut-calculator`.
2. Загрузи в него все файлы проекта.
3. Открой `Settings -> Pages`.
4. В `Build and deployment` выбери `GitHub Actions`.
5. Запушь изменения в ветку `main`.
6. Workflow из `.github/workflows/deploy.yml` сам соберет проект и выложит папку `dist/`.

Команды для первого пуша:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Chychyndr/slut-calculator.git
git push -u origin main
```

## Деплой на Vercel или Netlify

Проект уже содержит `vercel.json` и `netlify.toml`.

Для Vercel:

```text
Build command: npm run build
Output directory: dist
```

Для Netlify:

```text
Build command: npm run build
Publish directory: dist
```

## Структура

```text
slut-calculator/
├─ .github/workflows/deploy.yml
├─ src/
│  ├─ app.js
│  ├─ formula.js
│  └─ questions.js
├─ index.html
├─ styles.css
├─ package.json
├─ vite.config.js
├─ Dockerfile
├─ docker-compose.yml
├─ nginx.conf
├─ .dockerignore
├─ .gitignore
├─ netlify.toml
├─ vercel.json
├─ LICENSE
└─ README.md
```

## Лицензия

MIT. Можно свободно использовать, менять и распространять проект, если сохранить текст лицензии.
