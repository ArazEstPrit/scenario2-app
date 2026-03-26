import {
	type ItemActionResult,
	type ListActionResult,
	type VoidActionResult,
	register,
	call,
} from "#core/actions";
import { emitSync, listen } from "#core/events";
import { getStore, sortAndUpdateStore } from "#core/storage";

declare module "#core/storage" {
	interface StoreMap {
		"assignment-tracker/assignments": Omit<Assignment, "score">[];
	}
}

declare module "#core/events" {
	interface EventMap {
		"assignment-tracker:new-assignment": Assignment;
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"assignment-tracker:add": {
			arguments: Omit<Assignment, "id" | "completed" | "score">;
			returns: ItemActionResult<Assignment>;
		};
		"assignment-tracker:list": {
			arguments: { completed?: boolean };
			returns: ListActionResult<Assignment>;
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
	topicId?: number;
}

export function init() {
	register({
		name: "assignment-tracker:add",
		displayName: "Add Assignment",
		description: "Add a new assignment.",
		aliases: ["at:add"],
		arguments: {
			name: {
				type: "string",
				aliases: ["n"],
				validate: name => !!name.trim(),
			},
			description: { type: "string", aliases: ["D"], optional: true },
			dueDate: {
				type: "date",
				aliases: ["d"],
				description: "format: YYYY-MM-DD",
			},
			effort: {
				type: "number",
				aliases: ["e"],
				description: "from 1-6",
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
			importance: {
				type: "number",
				aliases: ["i"],
				description: "from 1-6",
				validate: val =>
					(0 < val && val <= 6) || "number must be between 1-6",
			},
			topicId: {
				type: "number",
				aliases: ["t"],
				optional: true,
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("assignment-tracker/assignments", []);
			const lastId = store.data.at(-1)?.id ?? -1;
			const assignment: Assignment = addScore({
				...params,
				id: lastId + 1,
				completed: false,
			});
			store.data.push(assignment);
			sortAndUpdateStore(store);
			emitSync("assignment-tracker:new-assignment", assignment);
			return assignment;
		},
	});

	register({
		name: "assignment-tracker:list",
		displayName: "List Assignments",
		description:
			"List your assignment sorted by priority score, optionally show completed ones.",
		aliases: ["at:list"],
		arguments: {
			completed: {
				type: "boolean",
				aliases: ["c"],
				displayName: "Show completed",
				optional: true,
				default: false,
			},
		},
		returnType: "list",
		execute({ completed }) {
			const store = getStore("assignment-tracker/assignments", []);
			return store.data
				.filter(a => !a.completed || completed)
				.map(addScore)
				.sort((a, b) => b.score - a.score);
		},
	});

	register({
		name: "assignment-tracker:remove",
		displayName: "Remove Assignment",
		description: "Permanently remove an assignment.",
		aliases: ["at:remove"],
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("assignment-tracker/assignments", []);
			const filtered = store.data.filter(a => a.id != id);
			if (filtered.length == store.data.length)
				throw "Assignment not found";
			store.data = filtered;
			sortAndUpdateStore(store);
		},
	});

	register({
		name: "assignment-tracker:complete",
		displayName: "Complete Assignment",
		description: "Complete an assignment. The assignment is not deleted.",
		aliases: ["at:complete"],
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("assignment-tracker/assignments", []);
			const assignment = store.data.find(a => a.id == id);
			if (!assignment) throw "Assignment not found";
			assignment.completed = true;
			sortAndUpdateStore(store);
		},
	});

	register({
		name: "assignment-tracker:edit",
		displayName: "Edit Assignment",
		description: "Edit an assignment.",
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
			dueDate: {
				type: "date",
				aliases: ["d"],
				optional: true,
				description: "format: YYYY-MM-DD",
			},
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
			topicId: {
				type: "number",
				aliases: ["t"],
				optional: true,
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("assignment-tracker/assignments", []);
			const assignment = store.data.find(a => a.id == params.id);
			if (!assignment) throw "Assignment not found";

			if (params.name) assignment.name = params.name;
			if (params.completed !== undefined)
				assignment.completed = params.completed;
			if (params.description) assignment.description = params.description;
			if (params.dueDate) assignment.dueDate = params.dueDate;
			if (params.effort) assignment.effort = params.effort;
			if (params.importance) assignment.importance = params.importance;

			sortAndUpdateStore(store);
			return addScore(assignment);
		},
	});

	listen("study-tracker:loaded", () => {
		const store = getStore("assignment-tracker/assignments", []);

		store.data.forEach(a => {
			if (a.topicId !== undefined) {
				call("study-tracker:boost-topic", {
					topicId: a.topicId,
					amount: addScore(a).score,
				});
			}
		});
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
