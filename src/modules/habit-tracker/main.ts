import {
	type ItemActionResult,
	type ListActionResult,
	type VoidActionResult,
	register,
} from "#core/actions";
import { getStore, updateStore } from "#core/storage";

declare module "#core/storage" {
	interface StoreMap {
		"habit-tracker/habits": Habit[];
		"habit-tracker/history": HabitInstance[];
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"habit-tracker:add": {
			arguments: Omit<Habit, "id">;
			returns: ItemActionResult<Habit>;
		};
		"habit-tracker:edit": {
			arguments: Pick<Habit, "id"> & Partial<Omit<Habit, "id" | "score">>;
			returns: ItemActionResult<Habit>;
		};
		"habit-tracker:list": {
			arguments: {};
			returns: ListActionResult<Habit>;
		};
		"habit-tracker:remove": {
			arguments: Pick<Habit, "id">;
			returns: VoidActionResult;
		};
		"habit-tracker:status": {
			arguments: {};
			returns: ListActionResult<Habit>;
		};
		"habit-tracker:log": {
			arguments: Pick<HabitInstance, "habitId" | "note">;
			returns: ItemActionResult<HabitInstance>;
		};
		"habit-tracker:history": {
			arguments: {};
			returns: ListActionResult<HabitInstance>;
		};
	}
}

interface Habit {
	id: number;
	name: string;
	description?: string;
	recurrence: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
	time: string;
}

interface HabitInstance {
	id: number;
	habitId: number;
	note?: string;
	date: Date;
}

export function init() {
	register({
		name: "habit-tracker:add",
		displayName: "Add Habit",
		description: "Add a habit.",
		aliases: ["ht:add"],
		arguments: {
			name: {
				type: "string",
				aliases: ["n"],
				validate: name => !!name.trim(),
			},
			description: { type: "string", aliases: ["D"], optional: true },
			recurrence: {
				type: "array",
				aliases: ["r"],
				itemType: "boolean",
				validate: arr => arr.length == 7 || "array must be of length 7",
			},
			time: {
				type: "string",
				aliases: ["t"],
				validate: val =>
					/\d\d:\d\d/g.test(val) || 'time must be in "XX:XX" format',
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("habit-tracker/habits", []);
			const lastId = store.data.at(-1)?.id ?? -1;
			const habit = { ...params, id: lastId + 1 };
			store.data.push(habit);
			updateStore(store);
			return habit;
		},
	});

	register({
		name: "habit-tracker:list",
		displayName: "List Habits",
		description: "List all habits.",
		aliases: ["ht:list"],
		arguments: {},
		returnType: "list",
		execute() {
			const store = getStore("habit-tracker/habits", []);
			return store.data;
		},
	});

	register({
		name: "habit-tracker:remove",
		displayName: "Remove Habit",
		description: "Remove a habit.",
		aliases: ["ht:remove"],
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("habit-tracker/habits", []);
			const filtered = store.data.filter(a => a.id != id);
			if (filtered.length == store.data.length) throw "Habit not found";
			store.data = filtered;
			updateStore(store);
		},
	});

	register({
		name: "habit-tracker:edit",
		displayName: "Edit Habit",
		description: "Edit a habit.",
		aliases: ["ht:edit"],
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
			recurrence: {
				type: "array",
				aliases: ["r"],
				optional: true,
				itemType: "boolean",
				validate: arr => arr.length == 7 || "array must be of length 7",
			},
			time: {
				type: "string",
				aliases: ["t"],
				optional: true,
				validate: val =>
					/\d\d:\d\d/g.test(val) || 'time must be in "XX:XX" format',
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("habit-tracker/habits", []);
			const habit = store.data.find(a => a.id == params.id);
			if (!habit) throw "habit not found";

			if (params.name) habit.name = params.name;
			if (params.description) habit.description = params.description;
			if (params.recurrence) habit.recurrence = params.recurrence;
			if (params.time) habit.time = params.time;

			store.data.push(habit);
			updateStore(store);
			return habit;
		},
	});

	register({
		name: "habit-tracker:status",
		displayName: "Show Status",
		description: "Show today's habits.",
		aliases: ["ht:status"],
		arguments: {},
		returnType: "list",
		execute() {
			return getStore("habit-tracker/habits", []).data.filter(
				h => h.recurrence[new Date().getDay()],
			);
		},
	});

	register({
		name: "habit-tracker:log",
		displayName: "Log Habit instance",
		description: "Log a habit for today.",
		aliases: ["ht:log"],
		arguments: {
			habitId: { type: "number" },
			note: { type: "string", optional: true },
		},
		returnType: "item",
		execute({ habitId, note }) {
			const habit = getStore("habit-tracker/habits", [])
				.data.filter(h => h.recurrence[new Date().getDay()])
				.find(h => h.id === habitId);
			if (!habit) throw "Habit not found";

			const history = getStore("habit-tracker/history", []);
			const lastId = history.data.at(-1)?.id ?? -1;

			const log = {
				habitId: habit.id,
				id: lastId + 1,
				date: new Date(),
			} as HabitInstance;

			if (note) log.note = note;
			history.data.push(log);
			updateStore(history);
			return log;
		},
	});

	register({
		name: "habit-tracker:history",
		displayName: "See log history",
		description: "See log history.",
		aliases: ["ht:history"],
		arguments: {},
		returnType: "list",
		execute() {
			const history = getStore("habit-tracker/history", []);
			return history.data;
		},
	});
}
