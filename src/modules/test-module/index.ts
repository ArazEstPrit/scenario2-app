import { emit } from "#core/events";

declare module "#core/events" {
	interface EventMap {
		"test-module:test1": { test: string };
	}
}

export function init() {
	console.log("test-module ran!");

	emit("test-module:test1", { test: "test payload" });
}
