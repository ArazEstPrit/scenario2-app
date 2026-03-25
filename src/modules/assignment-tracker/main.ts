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
			assignments: Omit<Assignment, "score">[];
		};
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"assignment-tracker:add": {
			arguments: Omit<Assignment, "id" | "completed" | "score">;
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
		"assignment-tracker:complete": {
			arguments: Pick<Assignment, "id">;
			returns: VoidActionResult;
		};
		"assignment-tracker:edit": {
			arguments: Pick<Assignment, "id"> &
				Partial<Omit<Assignment, "id" | "score">>;
			returns: ItemActionResult<Assignment>;
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
	score: number;
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
			const assignment: Assignment = addScore({
				...params,
				id: lastId + 1,
				completed: false,
			});
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
			return store.data.assignments.map(addScore);
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

	register({
		name: "assignment-tracker:complete",
		displayName: "Complete Assignment",
		aliases: ["at:complete"],
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("assignment-tracker/assignments", {
				assignments: [],
			});
			const assignment = store.data.assignments.find(a => a.id == id);
			if (!assignment) throw "Assignment not found";
			assignment.completed = true;
			updateStore(store);
		},
	});

	register({
		name: "assignment-tracker:edit",
		displayName: "Edit Assignment",
		aliases: ["at:edit"],
		arguments: {
			id: {
				type: "number",
			},
			name: {
				type: "string",
				optional: true,
				aliases: ["n"],
				validate: name => !!name.trim(),
			},
			description: { type: "string", aliases: ["D"], optional: true },
			dueDate: { type: "date", aliases: ["d"], optional: true },
			effort: {
				type: "number",
				aliases: ["e"],
				optional: true,
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
			importance: {
				type: "number",
				aliases: ["i"],
				optional: true,
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
			completed: {
				type: "boolean",
				aliases: ["c"],
				optional: true,
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("assignment-tracker/assignments", {
				assignments: [],
			});
			const assignment = store.data.assignments.find(
				a => a.id == params.id,
			);
			if (!assignment) throw "Assignment not found";

			if (params.name) assignment.name = params.name;
			if (params.completed) assignment.completed = params.completed;
			if (params.description) assignment.description = params.description;
			if (params.dueDate) assignment.dueDate = params.dueDate;
			if (params.effort) assignment.effort = params.effort;
			if (params.importance) assignment.importance = params.importance;

			store.data.assignments.push(assignment);
			updateStore(store);
			return addScore(assignment);
		},
	});
}

function addScore(
	assignment: Partial<Assignment> & Omit<Assignment, "score">,
): Assignment {
	assignment.score = calculateScore(
		assignment.effort,
		assignment.importance,
		assignment.dueDate,
		assignment.completed,
	);
	return assignment as Assignment;
}

function calculateScore(
	effort: number,
	importance: number,
	dueDate: Date,
	completed: boolean,
): number {
	const now = new Date();
	const daysUntilDueDate = Math.ceil(
		(dueDate.getTime() - now.getTime()) / 1000 / 3600 / 24,
	);

	const z = 2;
	return completed
		? 0
		: Math.round(
				((2 * importance) /
					Math.pow(
						daysUntilDueDate > 0 ? daysUntilDueDate : 1,
						1 / effort,
					)) *
					z,
			) / z;
}
