export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'aborted';

export type AsyncSignal<TValue = unknown> = {
	status: AsyncStatus;
	value?: TValue;
	error?: unknown;
	abort: AbortController;
};

export const createSignal = <TValue = unknown>(): AsyncSignal<TValue> => ({
	status: 'idle',
	abort: new AbortController(),
});

export const resetSignal = <TValue>(signal: AsyncSignal<TValue>): void => {
	signal.abort.abort();
	signal.abort = new AbortController();
	delete signal.value;
	delete signal.error;
	signal.status = 'idle';
};

export const markLoading = <TValue>(signal: AsyncSignal<TValue>): AbortSignal => {
	resetSignal(signal);
	signal.status = 'loading';
	return signal.abort.signal;
};

export const markReady = <TValue>(signal: AsyncSignal<TValue>, value: TValue): void => {
	if (signal.abort.signal.aborted) {
		signal.status = 'aborted';
		return;
	}
	signal.value = value;
	delete signal.error;
	signal.status = 'ready';
};

export const markFailed = <TValue>(signal: AsyncSignal<TValue>, error: unknown): void => {
	if (signal.abort.signal.aborted) {
		signal.status = 'aborted';
		return;
	}
	signal.error = error;
	signal.status = 'failed';
};
