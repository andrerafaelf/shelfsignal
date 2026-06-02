# ShelfSignal

ShelfSignal is a small stock tracking app for teams that need basic inventory visibility without a larger warehouse system.

It keeps the workflow simple: add items, set reorder thresholds, adjust stock, and export the current inventory to CSV. The backend is a small Node.js REST API and the frontend is plain browser JavaScript.

## What it does

- Track item quantity, category, unit, supplier, and location
- Mark low-stock items when they hit the reorder threshold
- Record manual stock adjustments with notes
- Keep a small usage/delivery history
- Export inventory as CSV

## Links

- Live demo: https://andrerafaelf.github.io/shelfsignal/
- Repository: https://github.com/andrerafaelf/shelfsignal

The live demo runs as a static GitHub Pages version, so changes are stored in your browser. Running locally with `npm start` uses the Node API and JSON store.

## Running it

```bash
npm start
```

Then open `http://localhost:4173`.

The app creates `data/store.json` from `data/seed.json` the first time it runs.

## API

- `GET /api/items`
- `POST /api/items`
- `PATCH /api/items/:id/adjust`
- `GET /api/export.csv`

## Stack

Node.js, native HTTP server, REST API, vanilla JavaScript, HTML, CSS, CSV export, and JSON file persistence.
