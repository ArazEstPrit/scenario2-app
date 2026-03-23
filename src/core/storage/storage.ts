import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { StoreName, StoreMap, Store } from "./types.ts";
import { dirname, join, resolve } from "path";

const STORE_DIR = resolve(import.meta.dirname, "../../../data/");

export function getStore<N extends StoreName>(
	name: N,
	defaultData?: StoreMap[N],
): Store<N> {
	const path = join(STORE_DIR, name + ".json");
	if (existsSync(path))
		return {
			name,
			data: JSON.parse(readFileSync(path, "utf-8")) as StoreMap[N],
		};
	else {
		return updateStore({ name, data: defaultData! });
	}
}

export function updateStore<N extends StoreName>(store: Store<N>): Store<N> {
	const path = join(STORE_DIR, store.name + ".json");
	if (!existsSync(dirname(path)))
		mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(store.data));
	return getStore(store.name);
}
