import { listen } from "#core/events";

export async function init() {
	listen("test-module:test1", () => {
		console.log("I intercepted new data!");
	});
}
