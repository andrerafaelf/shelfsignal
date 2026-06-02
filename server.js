import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function send(res, status, body, type = 'application/json') {
	res.writeHead(status, { 'content-type': type });
	res.end(type === 'application/json' ? JSON.stringify(body, null, 2) : body);
}

async function ensureStore() {
	await mkdir(DATA_DIR, { recursive: true });
	if (!existsSync(STORE_PATH)) await writeFile(STORE_PATH, await readFile(SEED_PATH, 'utf8'));
}

async function readStore() {
	await ensureStore();
	return JSON.parse(await readFile(STORE_PATH, 'utf8'));
}

async function writeStore(store) {
	await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

async function readBody(req) {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	return raw ? JSON.parse(raw) : {};
}

function cleanText(value) {
	return String(value || '').trim();
}

function number(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function itemError(input) {
	for (const key of ['name', 'category', 'unit', 'supplier', 'location']) {
		if (!cleanText(input[key])) return `${key} is required`;
	}
	if (number(input.quantity) === null || number(input.quantity) < 0) return 'Quantity must be zero or more';
	if (number(input.threshold) === null || number(input.threshold) < 0) return 'Threshold must be zero or more';
	return null;
}

function withSignals(store) {
	return store.items
		.map((item) => ({
			...item,
			status: item.quantity <= item.threshold ? 'reorder' : 'healthy',
			lastMovement: store.movements.find((movement) => movement.itemId === item.id) || null
		}))
		.sort((a, b) => Number(a.status === 'healthy') - Number(b.status === 'healthy'));
}

function toCsv(items) {
	const header = ['name', 'category', 'quantity', 'threshold', 'unit', 'supplier', 'location', 'status'];
	const rows = items.map((item) => header.map((key) => `"${String(item[key]).replaceAll('"', '""')}"`).join(','));
	return [header.join(','), ...rows].join('\n');
}

async function serveStatic(res, pathname) {
	const safePath = pathname === '/' ? '/index.html' : pathname;
	const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
	if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
	try {
		const file = await readFile(filePath);
		const ext = path.extname(filePath);
		const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html';
		send(res, 200, file, type);
	} catch {
		send(res, 404, 'Not found', 'text/plain');
	}
}

createServer(async (req, res) => {
	try {
		const url = new URL(req.url, `http://${req.headers.host}`);
		const store = await readStore();

		if (req.method === 'GET' && url.pathname === '/api/items') return send(res, 200, withSignals(store));

		if (req.method === 'GET' && url.pathname === '/api/export.csv') {
			res.writeHead(200, {
				'content-type': 'text/csv',
				'content-disposition': 'attachment; filename="shelfsignal-export.csv"'
			});
			return res.end(toCsv(withSignals(store)));
		}

		if (req.method === 'POST' && url.pathname === '/api/items') {
			const body = await readBody(req);
			const error = itemError(body);
			if (error) return send(res, 400, { error });
			const item = {
				id: `item_${Date.now()}`,
				name: cleanText(body.name),
				category: cleanText(body.category),
				quantity: number(body.quantity),
				threshold: number(body.threshold),
				unit: cleanText(body.unit),
				supplier: cleanText(body.supplier),
				location: cleanText(body.location)
			};
			store.items.unshift(item);
			await writeStore(store);
			return send(res, 201, item);
		}

		if (req.method === 'PATCH' && url.pathname.endsWith('/adjust')) {
			const id = url.pathname.split('/').at(-2);
			const item = store.items.find((entry) => entry.id === id);
			if (!item) return send(res, 404, { error: 'Item not found' });
			const body = await readBody(req);
			const delta = number(body.delta);
			if (delta === null || delta === 0) return send(res, 400, { error: 'Delta must be a non-zero number' });
			if (item.quantity + delta < 0) return send(res, 400, { error: 'Adjustment would make stock negative' });
			item.quantity += delta;
			store.movements.unshift({
				id: `move_${Date.now()}`,
				itemId: item.id,
				delta,
				note: cleanText(body.note) || 'Manual adjustment',
				createdAt: new Date().toISOString()
			});
			await writeStore(store);
			return send(res, 200, item);
		}

		return serveStatic(res, url.pathname);
	} catch (error) {
		send(res, 500, { error: error.message });
	}
}).listen(PORT, () => {
	console.log(`ShelfSignal running at http://localhost:${PORT}`);
});
