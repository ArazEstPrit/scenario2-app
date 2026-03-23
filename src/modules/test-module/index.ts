import { type ItemActionResult, register } from "#core/actions";
import { getStore, type Store, updateStore } from "#core/storage";
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
			returns: ItemActionResult<Store<"test-module/test">>;
		};
	}
}

declare module "#core/storage" {
	interface StoreMap {
		"test-module/test": { item: number }[];
	}
}

export function init() {
	console.log("test-module ran!");

	// emit("test-module:test1", { test: "test payload" });

	register({
		name: "test-module:action1",
		arguments: {},
		returnType: "item",
		execute() {
			const store = getStore("test-module/test", []);
			store.data.push({ item: (store.data.at(-1)?.item || 0) + 1 });
			updateStore(store);
			return store;
		},
	});
}
