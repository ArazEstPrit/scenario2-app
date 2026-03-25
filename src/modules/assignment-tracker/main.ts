import {
	type ItemActionResult,
	type ListActionResult,
	type VoidActionResult,
	register,
} from "#core/actions";
import { getStore, updateStore } from "#core/storage";

declare module "#core/storage" {
	interface StoreMap {
		"assignment-tracker/assignments": {
			assignments: Assignment[];
		};
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"assignment-tracker:add": {
			arguments: Omit<Assignment, "id" | "completed">;
			returns: ItemActionResult<Assignment>;
		};
		"assignment-tracker:list": {
			arguments: {};
			returns: ListActionResult<Assignment[]>;
		};
		"assignment-tracker:remove": {
			arguments: Pick<Assignment, "id">;
			returns: VoidActionResult;
		};
	}
}

interface Assignment {
	id: number;
	name: string;
	description?: string;
	dueDate: Date;
	effort: number;
	importance: number;
	completed: boolean;
}

export function init() {
	register({
		name: "assignment-tracker:add",
		displayName: "Add Assignment",
		aliases: ["at:add"],
		arguments: {
			name: {
				type: "string",
				aliases: ["n"],
				validate: name => !!name.trim(),
			},
			description: { type: "string", aliases: ["D"], optional: true },
			dueDate: { type: "date", aliases: ["d"] },
			effort: {
				type: "number",
				aliases: ["e"],
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
			importance: {
				type: "number",
				aliases: ["i"],
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("assignment-tracker/assignments", {
				assignments: [],
			});
			const lastId = store.data.assignments.at(-1)?.id ?? -1;
			const assignment: Assignment = {
				...params,
				id: lastId + 1,
				completed: false,
			};
			store.data.assignments.push(assignment);
			updateStore(store);
			return assignment;
		},
	});

	register({
		name: "assignment-tracker:list",
		displayName: "List Assignments",
		aliases: ["at:list"],
		arguments: {},
		returnType: "list",
		execute() {
			const store = getStore("assignment-tracker/assignments", {
				assignments: [],
			});
			return store.data.assignments;
		},
	});

	register({
		name: "assignment-tracker:remove",
		displayName: "Remove Assignment",
		aliases: ["at:remove"],
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("assignment-tracker/assignments", {
				assignments: [],
			});
			const filtered = store.data.assignments.filter(a => a.id != id);
			if (filtered.length == store.data.assignments.length)
				throw "Assignment not found";
			store.data.assignments = filtered;
			updateStore(store);
		},
	});
}
