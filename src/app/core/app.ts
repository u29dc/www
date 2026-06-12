import { startRuntime } from './loop';
import type { Owner } from './owner';

type AppConfig = Parameters<typeof startRuntime>[1];

export class App {
	private readonly owners: readonly Owner[];
	private readonly config: AppConfig;

	constructor(owners: readonly Owner[], config: AppConfig) {
		this.owners = owners;
		this.config = config;
	}

	start(): void {
		startRuntime(this.owners, this.config);
	}
}
