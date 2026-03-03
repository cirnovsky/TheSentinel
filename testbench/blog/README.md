# Mini Blog Testbench

Simple React mini-blog for agent testing.

## Run

```bash
cd testbench/blog
npm install
npm run dev
```

Open http://localhost:4173

## Data

Posts are stored in:

- `database/posts/*.md`

Edit/add markdown files with front matter (`id`, `title`, `author`, `publishedAt`, `tags`) to test content edits and generation workflows.

## Task Log

- 2026-03-01: create a new blog post titled: "My Romance History" and fill in random content
- 2026-03-01: edit 018-my-first-kiss.md so that it tells the love story of taylor swift
- 2026-03-01: change to dark mode
