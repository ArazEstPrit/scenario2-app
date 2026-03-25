import { registerCommand } from "#core/ui/cli";
import {
	ActionError,
	InvalidArgumentError,
	RequiredArgumentMissingError,
} from "./errors.ts";
import type {
	ActionMap,
	ActionName,
	ActionResult,
	Action,
	Arguments,
	InferArgsDefinition,
	AwaitedActionResult,
} from "./types.ts";

const actionMap = new Map<string, Action>();
const aliasMap = new Map<string, ActionName>();

export function getAction(name: ActionName | string): Action | undefined {
	const resolved = resolveAlias(name);
	return (
		actionMap.get(name) || (resolved ? actionMap.get(resolved) : undefined)
	);
}

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
	} as Awaited<ActionMap[N]["returns"]>;

	try {
		const args = parseArgs(
			action.arguments,
			rawArgs,
			actionName,
		) as ActionMap[N]["arguments"];

		result.data = action.execute(args);
	} catch (error) {
		result.success = false;
		result.error = new ActionError(
			`Action ${actionName} threw during execution.`,
			actionName,
			error,
		);
	}

	return result;
}

export async function callAsync<
	const N extends ActionName,
	R extends ActionResult = ActionMap[N]["returns"],
>(
	actionName: N,
	rawArgs: ActionMap[N]["arguments"],
): Promise<AwaitedActionResult<R>> {
	const result = call(actionName, rawArgs);
	await result.data;
	return result as AwaitedActionResult<R>;
}

function parseArgs(
	argDef: Arguments,
	args: Record<string, unknown>,
	action: string,
	parentArg?: string,
): Record<string, unknown> {
	for (const arg of Object.keys(argDef)) {
		const def = argDef[arg]!;
		const fullArgName = parentArg ? `${parentArg}.${arg}` : arg;
		if (!args[arg])
			if (!def.optional)
				throw new RequiredArgumentMissingError(action, fullArgName);
			else args[arg] = def.default;

		if (def.validate) {
			const result = def.validate(args[arg] as never); // as never because typescript is dumb
			if (result !== true)
				throw new InvalidArgumentError(
					action,
					fullArgName,
					typeof result == "string" ? result : "",
				);
		}

		if (def.type == "object")
			args[arg] = parseArgs(
				def.fields,
				args[arg] as Record<string, unknown>,
				action,
				fullArgName,
			);
	}
	return args;
}

export function resolveAlias(alias: string): ActionName | undefined {
	return aliasMap.get(alias);
}

register({
	name: "actions:help",
	aliases: ["h"],
	arguments: {},
	returnType: "item",
	execute() {
		return actionMap
			.values()
			.map(a => `${a.name} - ${a.aliases?.join("|")}`)
			.toArray()
			.join("\n");
	},
});
registerCommand("actions:help");
