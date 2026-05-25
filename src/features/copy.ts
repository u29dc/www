const copyText = async (text: string): Promise<void> => {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.inset = '0';
	textarea.style.opacity = '0';
	document.body.append(textarea);
	textarea.select();

	try {
		const execCommand = Reflect.get(document, 'execCommand') as ((commandId: string) => boolean) | undefined;
		execCommand?.call(document, 'copy');
	} finally {
		textarea.remove();
	}
};

const setStatus = (button: HTMLButtonElement, message: string): void => {
	const label = button.querySelector<HTMLElement>('[data-copy-label]');
	if (label) label.textContent = message;

	const status = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
	if (status) status.textContent = message;
};

const copyMarkdown = async (button: HTMLButtonElement): Promise<void> => {
	const source = button.dataset['copyMarkdown'];
	const idleLabel = button.dataset['copyIdle'] ?? 'Copy markdown';
	const doneLabel = button.dataset['copyDone'] ?? 'Copied';
	const errorLabel = button.dataset['copyError'] ?? 'Copy failed';

	if (!source) return;
	if (button.disabled) return;

	button.disabled = true;

	try {
		const response = await fetch(source, { headers: { Accept: 'text/markdown, text/plain' } });
		if (!response.ok) throw new Error(`Failed to fetch markdown: ${response.status}`);
		await copyText(await response.text());
		setStatus(button, doneLabel);
		window.setTimeout(() => setStatus(button, idleLabel), 1200);
	} catch {
		setStatus(button, errorLabel);
		window.setTimeout(() => setStatus(button, idleLabel), 1600);
	} finally {
		button.disabled = false;
	}
};

document.addEventListener('click', (event) => {
	if (!(event.target instanceof Element)) return;

	const button = event.target.closest<HTMLButtonElement>('[data-copy-markdown]');
	if (!(button instanceof HTMLButtonElement)) return;

	event.preventDefault();
	void copyMarkdown(button);
});
