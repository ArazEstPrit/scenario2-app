/**
 * Maps Action names to parameter and return types. All Actions must exist within the
 * `ActionMap`. Modules can extend this interface like so:
 * ```
 * // src/modules/my-module/index.ts
 * declare module "#core/actions" {
 * 	interface ActionMap {
 * 		"my-module:my-action": {
 * 			parameters: {};
 * 			returns: VoidActionResult;
 * 		};
 * 		"my-module:my-other-action": {
 * 			parameters: {
 * 				a: number;
 * 				b: string;
 * 			};
 * 			returns: ItemActionResult<{ c: boolean; d: Date }>;
 * 		};
 * 	}
 * }
 * ```
 *
 * Event names should have the following format: `"module-name:action-name"`.
 * Nested namespaces are also supported: `"module-name:ns1:ns2:action-name"`
 */
export interface ActionMap {
	"actions:help": {
		arguments: {};
		// TODO: it would be better to have a more structured result, which
		// gets serialized as a string by the caller.
		returns: ItemActionResult<string>;
	};
}

export type ActionName = keyof ActionMap;

export interface ArgumentTypeMap {
	string: string;
	number: number;
	boolean: boolean;
	date: Date;
	object: Record<string, unknown>;
	array: Array<unknown>;
}

type ArgumentName<T> = {
	[K in ArgumentType]: T extends ArgumentTypeMap[K] ? K : never;
}[ArgumentType];

export type ArgumentType = keyof ArgumentTypeMap;

export type Arguments = Record<string, Argument>;

type Argument<T extends ArgumentType = ArgumentType> = T extends "object"
	? ObjectArgument
	: T extends "array"
		? ArrayArgument
		: BaseArgument<T>;

interface BaseArgument<T extends ArgumentType> {
	displayName?: string;
	description?: string;
	type: T;
	required?: boolean;
	default?: ArgumentTypeMap[T];
	// TODO: boolean vs throw
	validate?: (value: ArgumentTypeMap[T]) => void;
}

interface ArrayArgument<
	A extends ArgumentType = ArgumentType,
> extends BaseArgument<"array"> {
	itemType: A;
}

interface ObjectArgument<
	A extends Arguments = Arguments,
> extends BaseArgument<"object"> {
	fields: A;
}

type InferArgsDefinition<A> =
	// Special case for if there are no args.
	A extends Record<string, never>
		? A
		: {
				[K in keyof A]: InferArgDefinition<A[K]>;
			};

type InferArgDefinition<
	A,
	N extends ArgumentName<A> = ArgumentName<A>,
> = N extends "object"
	? ObjectArgument<InferArgsDefinition<A>>
	: N extends "array"
		? // Holy shit how bad is this code
			ArrayArgument<ArgumentName<A extends Array<infer K> ? K : never>>
		: Argument<N>;

export type ActionResult<T = unknown> = VoidActionResult | ItemActionResult<T>;

interface BaseActionResult {
	type: string;
	success: boolean;
}

export interface VoidActionResult extends BaseActionResult {
	type: "void";
}

export interface ItemActionResult<T> extends BaseActionResult {
	type: "item";
	item: T;
}

export interface ListActionResult<T> extends BaseActionResult {
	type: "list";
	list: T[];
}

export interface Command<
	N extends ActionName = ActionName,
	A extends ActionMap[N]["arguments"] = ActionMap[N]["arguments"],
	U extends ActionMap[N]["returns"] = ActionMap[N]["returns"],
> {
	name: N;
	displayName?: string;
	aliases?: string[];
	description?: string;
	arguments: InferArgsDefinition<A>;
	execute(params: A): U;
}
