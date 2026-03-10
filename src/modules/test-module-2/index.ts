import { type EventEmission, listen } from "#core/events";

export function init() {
	console.log("module 2 ran!");

	// this module is loaded after test-module is loaded, so this module only
	// starts listening to the "test1" event after its already emitted. This is
	// why we enable sticky mode on this listener.
	listen("test-module:test1", handleEvent, { sticky: true });
}

function handleEvent(emission: EventEmission<"test-module:test1">) {
	console.log("event handled by test-module-2!\npayload:", emission.payload);
}
