const $ = (selector) => document.querySelector(selector);
const isStaticDemo = location.hostname.endsWith('github.io');
const storageKey = 'shelfsignal-demo-store';
const seed = {
	items: [
		{ id: 'item_1001', name: 'Coffee beans', category: 'Kitchen', quantity: 8, threshold: 10, unit: 'kg', supplier: 'Lisbon Roasters', location: 'Shelf A' },
		{ id: 'item_1002', name: 'Thermal labels', category: 'Packing', quantity: 42, threshold: 20, unit: 'rolls', supplier: 'PrintPro', location: 'Shelf C' },
		{ id: 'item_1003', name: 'Nitrile gloves', category: 'Safety', quantity: 6, threshold: 12, unit: 'boxes', supplier: 'Medline', location: 'Cabinet 2' }
	],
	movements: [
		{ id: 'move_2001', itemId: 'item_1001', delta: -2, note: 'Weekend usage', createdAt: '2026-05-31T09:30:00.000Z' },
		{ id: 'move_2002', itemId: 'item_1002', delta: 10, note: 'Supplier delivery', createdAt: '2026-05-29T14:00:00.000Z' }
	]
};

function getStore() {
	const saved = localStorage.getItem(storageKey);
	return saved ? JSON.parse(saved) : structuredClone(seed);
}

function saveStore(store) {
	localStorage.setItem(storageKey, JSON.stringify(store));
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

async function demoApi(path, options = {}) {
	const store = getStore();
	const body = options.body ? JSON.parse(options.body) : {};
	if (path === '/api/items') return withSignals(store);
	if (path === '/api/items' && options.method === 'POST') {
		const item = { id: `item_${Date.now()}`, ...body, quantity: Number(body.quantity), threshold: Number(body.threshold) };
		store.items.unshift(item);
		saveStore(store);
		return item;
	}
	if (path.endsWith('/adjust') && options.method === 'PATCH') {
		const id = path.split('/').at(-2);
		const item = store.items.find((entry) => entry.id === id);
		if (!item) throw new Error('Item not found');
		const delta = Number(body.delta);
		if (item.quantity + delta < 0) throw new Error('Adjustment would make stock negative');
		item.quantity += delta;
		store.movements.unshift({ id: `move_${Date.now()}`, itemId: id, delta, note: body.note || 'Manual adjustment', createdAt: new Date().toISOString() });
		saveStore(store);
		return item;
	}
	throw new Error('Route not available in demo mode');
}

async function api(path, options = {}) {
	if (isStaticDemo) return demoApi(path, options);
	const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data;
}

async function load() {
	const items = await api('/api/items');
	$('#items').innerHTML = items.map(renderItem).join('');
}

function renderItem(item) {
	const movement = item.lastMovement
		? `${item.lastMovement.delta > 0 ? '+' : ''}${item.lastMovement.delta} - ${item.lastMovement.note}`
		: 'No movement yet';

	return `
		<article class="item ${item.status}">
			<div class="item-head">
				<div>
					<strong>${item.name}</strong>
					<span>${item.category} - ${item.location}</span>
				</div>
				<b>${item.status}</b>
			</div>
			<div class="meter">
				<span style="width:${Math.min(100, (item.quantity / Math.max(item.threshold * 2, 1)) * 100)}%"></span>
			</div>
			<p>${item.quantity} ${item.unit} in stock. Reorder at ${item.threshold}. Supplier: ${item.supplier}.</p>
			<small>${movement}</small>
			<form data-adjust="${item.id}" class="adjust">
				<input name="delta" type="number" placeholder="+5 or -2" required />
				<input name="note" placeholder="Reason" />
				<button>Adjust</button>
			</form>
		</article>
	`;
}

$('#item-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	try {
		await api('/api/items', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
		$('#form-status').textContent = 'Item saved.';
		form.reset();
		await load();
	} catch (error) {
		$('#form-status').textContent = error.message;
	}
});

$('#items').addEventListener('submit', async (event) => {
	const form = event.target.closest('form[data-adjust]');
	if (!form) return;
	event.preventDefault();
	const payload = Object.fromEntries(new FormData(form));
	try {
		await api(`/api/items/${form.dataset.adjust}/adjust`, {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
		await load();
	} catch (error) {
		$('#form-status').textContent = error.message;
	}
});

$('#export-link').addEventListener('click', async (event) => {
	if (!isStaticDemo) return;
	event.preventDefault();
	const csv = toCsv(await api('/api/items'));
	const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = 'shelfsignal-export.csv';
	link.click();
	URL.revokeObjectURL(url);
});

load();