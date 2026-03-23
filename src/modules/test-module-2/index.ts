// import { type EventEmission, listen } from "#core/events";

import { call } from "#core/actions";

export function init() {
	console.log("test-module-2 ran!");

	// this module is loaded after test-module is loaded, so this module only
	// starts listening to the "test1" event after its already emitted. This is
	// why we enable sticky mode on this listener.
	// listen("test-module:test1", handleEvent, { sticky: true });

	const result = call("test-module:action1", { a: { b: 123, c: 43 } });
	console.log("Result:", result);
}

// function handleEvent(emission: EventEmission<"test-module:test1">) {
// 	console.log("event handled by test-module-2!\npayload:", emission.payload);
// }
