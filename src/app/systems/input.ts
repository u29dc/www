import { BaseModule, type Context } from '../core/module';
import type { InputState, KeyboardState, PointerState, WheelState } from '../core/state';
import { composedPath } from '../utils/dom';

type InputIntentHandler<T> = (intent: T) => void;

type InputModifiers = {
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	isModified: boolean;
};

export type InputPointerIntent = {
	type: 'over' | 'move' | 'out' | 'down' | 'up' | 'cancel';
	x: number;
	y: number;
	target: EventTarget | null;
	relatedTarget: EventTarget | null;
	path: EventTarget[];
};

export type InputWheelIntent = InputModifiers & {
	dx: number;
	dy: number;
	rawDx: number;
	rawDy: number;
	deltaMode: number;
	source: 'wheel';
	target: EventTarget | null;
	path: EventTarget[];
	readonly defaultPrevented: boolean;
	preventDefault: () => void;
};

export type InputClickIntent = InputModifiers & {
	button: number;
	isPrimary: boolean;
	target: EventTarget | null;
	path: EventTarget[];
	readonly defaultPrevented: boolean;
	preventDefault: () => void;
};

const LINE_HEIGHT = 100 / 6;
const PAGE_RATIO = 0.9;

const emptyPointer = (): PointerState => ({
	x: 0,
	y: 0,
	nx: 0,
	ny: 0,
	dx: 0,
	dy: 0,
	vx: 0,
	vy: 0,
	isDown: false,
	wasPressed: false,
	wasReleased: false,
	activePointerType: 'unknown',
	target: null,
	relatedTarget: null,
	path: [],
	exited: false,
});

const emptyWheel = (): WheelState => ({
	dx: 0,
	dy: 0,
	source: 'none',
});

const emptyKeyboard = (): KeyboardState => ({
	lastKey: '',
	hadKeyboardInput: false,
	activeKeys: [],
});

const createInputState = (): InputState => ({
	generation: 0,
	pointer: emptyPointer(),
	wheel: emptyWheel(),
	keyboard: emptyKeyboard(),
});

const keyboardKeyId = (event: KeyboardEvent): string => (event.code.length > 0 ? event.code : `key:${event.key}`);

class InputOwner extends BaseModule {
	readonly name = 'input';

	private state = createInputState();
	private previousX = 0;
	private previousY = 0;
	private generation = 0;
	private activeKeys = new Map<string, string>();
	private readonly pointerHandlers = new Set<InputIntentHandler<InputPointerIntent>>();
	private readonly wheelHandlers = new Set<InputIntentHandler<InputWheelIntent>>();
	private readonly clickHandlers = new Set<InputIntentHandler<InputClickIntent>>();

	override preinit(context: Context): void {
		super.preinit(context);
		document.addEventListener('pointerover', this.handlePointerOver, { passive: true });
		document.addEventListener('pointermove', this.handlePointerMove, { passive: true });
		document.addEventListener('pointerout', this.handlePointerOut, { passive: true });
		document.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
		document.addEventListener('pointerup', this.handlePointerUp, { passive: true });
		document.addEventListener('pointercancel', this.handlePointerCancel, { passive: true });
		document.addEventListener('wheel', this.handleWheel, { passive: false });
		document.addEventListener('click', this.handleClick, { capture: true });
		document.addEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keyup', this.handleKeyUp);
		window.addEventListener('blur', this.handleInputLoss, { passive: true });
		window.addEventListener('pagehide', this.handleInputLoss, { passive: true });
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		this.addCleanup(() => document.removeEventListener('pointerover', this.handlePointerOver));
		this.addCleanup(() => document.removeEventListener('pointermove', this.handlePointerMove));
		this.addCleanup(() => document.removeEventListener('pointerout', this.handlePointerOut));
		this.addCleanup(() => document.removeEventListener('pointerdown', this.handlePointerDown));
		this.addCleanup(() => document.removeEventListener('pointerup', this.handlePointerUp));
		this.addCleanup(() => document.removeEventListener('pointercancel', this.handlePointerCancel));
		this.addCleanup(() => document.removeEventListener('wheel', this.handleWheel));
		this.addCleanup(() => document.removeEventListener('click', this.handleClick, { capture: true }));
		this.addCleanup(() => document.removeEventListener('keydown', this.handleKeyDown));
		this.addCleanup(() => document.removeEventListener('keyup', this.handleKeyUp));
		this.addCleanup(() => window.removeEventListener('blur', this.handleInputLoss));
		this.addCleanup(() => window.removeEventListener('pagehide', this.handleInputLoss));
		this.addCleanup(() => document.removeEventListener('visibilitychange', this.handleVisibilityChange));
	}

	override dispose(): void {
		this.pointerHandlers.clear();
		this.wheelHandlers.clear();
		this.clickHandlers.clear();
		super.dispose();
	}

	getState(): InputState {
		return this.state;
	}

	flushFrame(): void {
		this.state = {
			...this.state,
			pointer: {
				...this.state.pointer,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				wasPressed: false,
				wasReleased: false,
				relatedTarget: null,
				exited: false,
			},
			wheel: emptyWheel(),
			keyboard: {
				...this.state.keyboard,
				hadKeyboardInput: false,
			},
		};
	}

	onPointerIntent(handler: InputIntentHandler<InputPointerIntent>): () => void {
		this.pointerHandlers.add(handler);
		return () => {
			this.pointerHandlers.delete(handler);
		};
	}

	onWheelIntent(handler: InputIntentHandler<InputWheelIntent>): () => void {
		this.wheelHandlers.add(handler);
		return () => {
			this.wheelHandlers.delete(handler);
		};
	}

	onClickIntent(handler: InputIntentHandler<InputClickIntent>): () => void {
		this.clickHandlers.add(handler);
		return () => {
			this.clickHandlers.delete(handler);
		};
	}

	private nextGeneration(): number {
		this.generation += 1;
		return this.generation;
	}

	private activeKeyValues(): string[] {
		return Array.from(new Set(this.activeKeys.values()));
	}

	private updatePointer(event: PointerEvent, type: InputPointerIntent['type'], options?: { pressed?: boolean; released?: boolean; exited?: boolean }): InputPointerIntent {
		const x = event.clientX;
		const y = event.clientY;
		const dx = x - this.previousX;
		const dy = y - this.previousY;
		this.previousX = x;
		this.previousY = y;
		const width = window.innerWidth || 1;
		const height = window.innerHeight || 1;
		const path = composedPath(event);
		const relatedTarget = event.relatedTarget;
		const isDown = options?.released ? false : options?.pressed ? true : this.state.pointer.isDown;
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			pointer: {
				x,
				y,
				nx: (x / width) * 2 - 1,
				ny: 1 - (y / height) * 2,
				dx,
				dy,
				vx: dx,
				vy: dy,
				isDown,
				wasPressed: this.state.pointer.wasPressed || options?.pressed === true,
				wasReleased: this.state.pointer.wasReleased || options?.released === true,
				activePointerType: event.pointerType || 'unknown',
				target: event.target,
				relatedTarget,
				path,
				exited: options?.exited ?? false,
			},
		};
		this.requestFrame(`input:pointer:${type}`);
		return { type, x, y, target: event.target, relatedTarget, path };
	}

	private releaseActiveInput(): void {
		const hasActiveInput = this.state.pointer.isDown || this.activeKeys.size > 0 || this.state.keyboard.activeKeys.length > 0;
		if (!hasActiveInput) return;
		this.activeKeys.clear();
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			pointer: {
				...this.state.pointer,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				isDown: false,
				wasPressed: false,
				wasReleased: false,
				relatedTarget: null,
				exited: false,
			},
			keyboard: {
				...this.state.keyboard,
				hadKeyboardInput: false,
				activeKeys: [],
			},
		};
		this.requestFrame('input:release');
	}

	private emitPointerIntent(intent: InputPointerIntent): void {
		for (const handler of Array.from(this.pointerHandlers)) {
			try {
				handler(intent);
			} catch (error) {
				this.reportError('input.pointer', error);
			}
		}
	}

	private readonly handlePointerOver = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'over'));

	private readonly handlePointerMove = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'move'));

	private readonly handlePointerOut = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'out', { exited: true }));

	private readonly handlePointerDown = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'down', { pressed: true }));

	private readonly handlePointerUp = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'up', { released: true }));

	private readonly handlePointerCancel = (event: PointerEvent): void => this.emitPointerIntent(this.updatePointer(event, 'cancel', { released: true, exited: true }));

	private readonly handleWheel = (event: WheelEvent): void => {
		const dx = normalizeWheelDelta(event.deltaX, event.deltaMode, window.innerWidth);
		const dy = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			wheel: {
				dx: this.state.wheel.dx + dx,
				dy: this.state.wheel.dy + dy,
				source: 'wheel',
			},
		};
		const intent = createWheelIntent(event, dx, dy);
		try {
			for (const handler of Array.from(this.wheelHandlers)) {
				try {
					handler(intent);
				} catch (error) {
					this.reportError('input.wheel', error);
				}
			}
		} finally {
			this.requestFrame('input:wheel');
		}
	};

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		this.activeKeys.set(keyboardKeyId(event), event.key);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: this.activeKeyValues(),
			},
		};
		this.requestFrame('input:keydown');
	};

	private readonly handleKeyUp = (event: KeyboardEvent): void => {
		this.activeKeys.delete(keyboardKeyId(event));
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: this.activeKeyValues(),
			},
		};
		this.requestFrame('input:keyup');
	};

	private readonly handleClick = (event: MouseEvent): void => {
		const intent = createClickIntent(event);
		try {
			for (const handler of Array.from(this.clickHandlers)) {
				try {
					handler(intent);
				} catch (error) {
					this.reportError('input.click', error);
				}
			}
		} finally {
			this.requestFrame('input:click');
		}
	};

	private readonly handleInputLoss = (): void => this.releaseActiveInput();

	private readonly handleVisibilityChange = (): void => {
		if (document.visibilityState !== 'visible') this.releaseActiveInput();
	};
}

const normalizeWheelDelta = (delta: number, mode: number, size: number): number => {
	if (mode === WheelEvent.DOM_DELTA_LINE) return delta * LINE_HEIGHT;
	if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * size * PAGE_RATIO;
	return delta;
};

const readModifiers = (event: Pick<MouseEvent | WheelEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): InputModifiers => ({
	altKey: event.altKey,
	ctrlKey: event.ctrlKey,
	metaKey: event.metaKey,
	shiftKey: event.shiftKey,
	isModified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
});

const createWheelIntent = (event: WheelEvent, dx: number, dy: number): InputWheelIntent => ({
	...readModifiers(event),
	dx,
	dy,
	rawDx: event.deltaX,
	rawDy: event.deltaY,
	deltaMode: event.deltaMode,
	source: 'wheel',
	target: event.target,
	path: composedPath(event),
	get defaultPrevented() {
		return event.defaultPrevented;
	},
	preventDefault: () => event.preventDefault(),
});

const createClickIntent = (event: MouseEvent): InputClickIntent => ({
	...readModifiers(event),
	button: event.button,
	isPrimary: event.button === 0,
	target: event.target,
	path: composedPath(event),
	get defaultPrevented() {
		return event.defaultPrevented;
	},
	preventDefault: () => event.preventDefault(),
});

export const input = new InputOwner();
export const getInputState = (): InputState => input.getState();
export const flushInputFrame = (): void => input.flushFrame();
export const onInputPointerIntent = (handler: InputIntentHandler<InputPointerIntent>): (() => void) => input.onPointerIntent(handler);
export const onInputWheelIntent = (handler: InputIntentHandler<InputWheelIntent>): (() => void) => input.onWheelIntent(handler);
export const onInputClickIntent = (handler: InputIntentHandler<InputClickIntent>): (() => void) => input.onClickIntent(handler);
