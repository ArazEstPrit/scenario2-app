import type {
	ActionMap,
	ActionName,
	Command,
	VoidActionResult,
} from "./types.ts";

export function register<const N extends ActionName>(command: Command<N>) {}

export function call<const N extends ActionName>(
	commandName: N,
	args: ActionMap[N]["arguments"],
): ActionMap[N]["returns"] {}

declare module "#core/actions" {
	export interface ActionMap {
		asd: {
			arguments: {
				asd: boolean;
				asdd: {
					a: number;
					b: Date[];
				};
			};
			returns: VoidActionResult;
		};
	}
}

register({
	name: "asd",
	arguments: {
		asd: { type: "boolean" },
		asdd: {
			type: "object",
			fields: {
				a: { type: "number" },
				b: { type: "array", itemType: "date" },
			},
		},
	},
	execute(params) {
		params.asdd.b;
		return { type: "void", success: true };
	},
});

register({
	name: "actions:help",
	arguments: {},
	execute(params) {
		params;
		return { type: "item", success: true, item: "" };
	},
});
