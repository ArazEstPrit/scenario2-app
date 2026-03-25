import { register, type ListActionResult } from "#core/actions";
import {
	getStore,
	type Store,
	updateStore,
	type StoreMap,
} from "#core/storage";
import { registerCommand } from "#core/ui/cli";
import { emit } from "#core/events";

declare module "#core/events" {
	interface EventMap {
		"test-module:test1": { newData: StoreMap["test-module/test"] };
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"test-module:action1": {
			arguments: {};
			returns: ListActionResult<Store<"test-module/test">["data"]>;
		};
	}
}

declare module "#core/storage" {
	interface StoreMap {
		"test-module/test": { item: number }[];
	}
}

export function init() {
	register({
		name: "test-module:action1",
		aliases: ["a1"],
		arguments: {},
		returnType: "list",
		execute() {
			const store = getStore("test-module/test", []);
			store.data.push({ item: (store.data.at(-1)?.item || 0) + 1 });
			updateStore(store);
			emit("test-module:test1", { newData: store.data });
			return store.data;
		},
	});

	registerCommand("test-module:action1");
}
