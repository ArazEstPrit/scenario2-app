import { type ItemActionResult, register } from "#core/actions";
// import { emit } from "#core/events";

declare module "#core/events" {
	interface EventMap {
		"test-module:test1": { test: string };
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"test-module:action1": {
			arguments: {
				a: number;
				b: number;
			};
			returns: ItemActionResult<{ sum: number }>;
		};
	}
}

export function init() {
	console.log("test-module ran!");

	// emit("test-module:test1", { test: "test payload" });

	register({
		name: "test-module:action1",
		arguments: {
			a: { type: "number", displayName: "First number" },
			b: { type: "number", displayName: "Second number" },
		},
		execute(params) {
			console.log("Action Ran!");

			return {
				type: "item",
				item: {
					sum: params.a + params.b,
				},
				success: true,
			};
		},
	});
}
