import { register, type VoidActionResult } from "#core/actions";
import { getStore, updateStore } from "#core/storage";
// import { emit } from "#core/events";

declare module "#core/events" {
	interface EventMap {
		"test-module:test1": { test: string };
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"test-module:action1": {
			arguments: {};
			returns: VoidActionResult;
		};
	}
}

declare module "#core/storage" {
	interface StoreMap {
		"test-module:test": { item: number }[];
	}
}

export function init() {
	console.log("test-module ran!");

	// emit("test-module:test1", { test: "test payload" });

	register({
		name: "test-module:action1",
		arguments: {},
		returnType: "void",
		execute() {
			const store = getStore("test-module:test", []);
			store.data.push({ item: (store.data.at(-1)?.item || 0) + 1 });
			console.log(store);
			updateStore(store);
		},
	});
}
