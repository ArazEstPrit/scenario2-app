import {
	type ActionResult,
	type Arguments,
	type ItemActionResult,
	type ListActionResult,
	type Argument,
	callAsync,
	getAction,
} from "#core/actions";
import type { RawParsedCommandArguments } from "./types.ts";
import { CommandError } from "./errors.ts";

export async function run(args: string[]) {
	const { commandName, params } = parseArgs(args);
	if (!commandName) throw new CommandError("No command provided!");
	const action = getAction(commandName);
	if (!action) throw new CommandError("Command not found! " + commandName);
	const resolvedParams = resolveParams(params, action.arguments);
	const result = await callAsync(action.name, resolvedParams);
	displayResult(result);
}

function parseArgs(args: string[]): RawParsedCommandArguments {
	const commandName = args.shift();

	const removeQuotes = (a: string) =>
		['""', "''"].includes(a.slice(0, 1) + a.slice(-1)) ? a.slice(1, -1) : a;

	return args.reduce(
		(parsed, arg) => {
			if (arg.startsWith("-")) {
				const [optionName, rawOptionValue] = arg
					.replace(/^-+/, "")
					.split("=");

				if (!optionName) return parsed;

				// If `rawArgumentValue` is undefined, that means that the user
				// inputted the option as `--option` without `=value`. This is
				// interpreted like `--option=true`
				const optionValue = rawOptionValue || "true";

				parsed.params[optionName] = removeQuotes(optionValue);
			}

			return parsed;
		},
		{
			commandName: commandName,
			params: {},
		} as RawParsedCommandArguments,
	);
}

function resolveParams(
	params: RawParsedCommandArguments["params"],
	argDef: Arguments,
): Record<string, unknown> {
	const resolvedParams = {} as Record<string, unknown>;

	for (const arg of Object.keys(argDef)) {
		resolvedParams[arg] = resolveParamType(
			[arg]
				.concat(argDef[arg]?.aliases || [])
				.map(key => params[key])
				.find(val => val !== undefined),
			argDef[arg]!,
		);
	}

	return resolvedParams;
}

function resolveParamType(param: string | undefined, def: Argument) {
	if (param === undefined) return undefined;

	switch (def.type) {
		case "string":
			return param;
		case "number":
			const num = parseFloat(param);
			return isNaN(num) ? undefined : num;
		case "boolean":
			return ["false", "f"].includes(param.toLowerCase()) ? false : true;
		case "date":
			const date = new Date(param);
			return isNaN(date.getTime()) ? undefined : date;
		case "array":
			return param.split(",");
		default:
			return undefined;
	}
}

function displayResult(result: ActionResult) {
	if (!result.success)
		console.error("Error occured while running command:", result.error);

	switch (result.type) {
		case "void":
			break;
		case "item":
			displayItem(result);
			break;
		case "list":
			displayList(result);
			break;
	}
}

function displayItem(result: ItemActionResult<unknown>) {
	console.log(result.data);
}

function displayList(result: ListActionResult<unknown>) {
	for (const res of result.data) {
		console.log(res);
	}
}
