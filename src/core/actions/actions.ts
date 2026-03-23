import type {
	ActionMap,
	ActionName,
	Action,
	Arguments,
	InferArgsDefinition,
} from "./types.ts";

const actionMap = new Map<string, Action<ActionName, Arguments>>();
const aliasMap = new Map<string, string>();

export function register<const N extends ActionName>(
	action: Action<N, InferArgsDefinition<ActionMap[N]["arguments"]>>,
) {
	actionMap.set(action.name, action);

	if (action.displayName) aliasMap.set(action.displayName, action.name);
	action.aliases?.forEach(a => aliasMap.set(a, action.name));
}

export function call<const N extends ActionName>(
	actionName: N,
	rawArgs: ActionMap[N]["arguments"],
): ActionMap[N]["returns"] {
	const action = actionMap.get(actionName) as Action<
		N,
		InferArgsDefinition<ActionMap[N]["arguments"]>
	>;
	// TODO: check if action exists

	const result = {
		type: action.returnType,
		success: true,
	} as ActionMap[N]["returns"];

	const args = parseArgs(action.arguments, rawArgs) as Parameters<
		(typeof action)["execute"]
	>[0];

	try {
		result.data = action.execute(args);
	} catch (error) {
		result.success = false;
		result.error = error;
	}

	return result;
}

function parseArgs(
	argDef: Arguments,
	args: Record<string, unknown>,
): Record<string, unknown> {
	for (const arg of Object.keys(argDef)) {
		const def = argDef[arg]!;
		if (!args[arg])
			if (!def.optional) throw "RequiredParameterMissingError";
			else args[arg] = def.default;

		if (def.validate) {
			const result = def.validate(args[arg] as never); // as never because typescript is dumb
			if (result !== true)
				throw (
					"Invalid parameter: " +
					(typeof result == "string" ? result : "")
				);
		}

		if (def.type == "object")
			args[arg] = parseArgs(
				def.fields,
				args[arg] as Record<string, unknown>,
			);
	}
	return args;
}

export function resolveAlias(alias: string) {}

register({
	name: "actions:help",
	arguments: {},
	returnType: "item",
	execute() {
		return "";
	},
});

// TODO:
// - async actions - ActionTimeoutError
