const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
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
	await api(`/api/items/${form.dataset.adjust}/adjust`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
	await load();
});

load();
