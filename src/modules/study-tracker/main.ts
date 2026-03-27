import {
	type ItemActionResult,
	type ListActionResult,
	type VoidActionResult,
	register,
} from "#core/actions";
import { emit } from "#core/events";
import { getStore, sortAndUpdateStore } from "#core/storage";

declare module "#core/storage" {
	interface StoreMap {
		"study-tracker/sessions": Session[];
		"study-tracker/topics": Topic[];
		"study-tracker/history": PastSession[];
	}
}

declare module "#core/events" {
	interface EventMap {
		// This type of event should probably be generalised by the module
		// registration subsystem. Something like "modules:loaded", and the
		// payload would include the name. For now though, since this is the
		// only place its needed yet, I think its fine
		"study-tracker:loaded": null;
	}
}

declare module "#core/actions" {
	interface ActionMap {
		"study-tracker:add-topic": {
			arguments: Omit<Topic, "id" | "boost">;
			returns: ItemActionResult<Topic>;
		};
		"study-tracker:list-topics": {
			arguments: { scored?: boolean };
			returns: ListActionResult<ScoredTopic>;
		};
		"study-tracker:remove-topic": {
			arguments: Pick<Topic, "id">;
			returns: VoidActionResult;
		};
		"study-tracker:edit-topic": {
			arguments: Pick<Topic, "id"> & Partial<Omit<Topic, "id" | "boost">>;
			returns: ItemActionResult<Topic>;
		};
		"study-tracker:boost-topic": {
			arguments: { topicId: number; amount: number };
			returns: VoidActionResult;
		};
		"study-tracker:add-session": {
			arguments: Omit<Session, "id">;
			returns: ItemActionResult<Session>;
		};
		"study-tracker:list-sessions": {
			arguments: {};
			returns: ListActionResult<
				Omit<Session, "day" | "topicId"> & {
					day: string;
					topic: string;
				}
			>;
		};
		"study-tracker:edit-session": {
			arguments: Pick<Session, "id"> & Partial<Omit<Session, "id">>;
			returns: ItemActionResult<Session>;
		};
		"study-tracker:remove-session": {
			arguments: Pick<Session, "id">;
			returns: VoidActionResult;
		};
		"study-tracker:log": {
			arguments: Omit<PastSession, "id" | "date">;
			returns: ItemActionResult<PastSession>;
		};
		"study-tracker:history": {
			arguments: { topicId?: number };
			returns: ListActionResult<
				Omit<PastSession, "topicId"> & { topic: string }
			>;
		};
		"study-tracker:recommend": {
			arguments: { count?: number };
			returns: ListActionResult<ScoredTopic>;
		};
	}
}

interface Topic {
	id: number;
	name: string;
	description?: string;
	parentId?: number | null;
	difficulty: number;
	boost: number;
}

interface ScoredTopic extends Topic {
	score: number;
	lastStudied: string | null;
	sessionCount: number;
}

interface Session {
	id: number;
	type: "static" | "dynamic";
	day: number;
	timeStart: string;
	timeEnd: string;
	topicId?: number;
}

interface PastSession {
	id: number;
	topicId: number;
	date: Date;
	progress: number;
	note?: string;
}

const HISTORY_WINDOW = 5;

function scoreTopic(topic: Topic, history: PastSession[]): number {
	const relevant = history
		.filter(h => h.topicId === topic.id)
		.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);

	let recencyFactor: number;
	if (relevant.length === 0) {
		recencyFactor = 10;
	} else {
		const lastDate = new Date(relevant[0]!.date);
		const daysSince = Math.max(
			0,
			(Date.now() - lastDate.getTime()) / 86_400_000,
		);
		recencyFactor = Math.log2(daysSince + 2);
	}

	const recentSessions = relevant.slice(0, HISTORY_WINDOW);
	let struggleFactor: number;
	if (recentSessions.length === 0) {
		struggleFactor = 1;
	} else {
		const avgProgress =
			recentSessions.reduce((s, h) => s + h.progress, 0) /
			recentSessions.length;
		struggleFactor = (6 - avgProgress) / (avgProgress * 0.8);
	}

	const raw = topic.difficulty * recencyFactor * struggleFactor + topic.boost;
	return Math.round(raw * 10) / 10;
}

function buildScoredTopic(topic: Topic, history: PastSession[]): ScoredTopic {
	const relevant = history
		.filter(h => h.topicId === topic.id)
		.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);

	const lastStudied = relevant[0]
		? new Date(relevant[0].date).toLocaleDateString("en-GB")
		: null;

	return {
		...topic,
		score: scoreTopic(topic, history),
		lastStudied,
		sessionCount: relevant.length,
	};
}

function nextId<T extends { id: number }>(arr: T[]): number {
	return (arr.at(-1)?.id ?? -1) + 1;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function init() {
	register({
		name: "study-tracker:add-topic",
		displayName: "Add Study Topic",
		aliases: ["st:add-topic"],
		description: "Add a topic (or sub-topic) to your study list.",
		arguments: {
			name: {
				type: "string",
				aliases: ["n"],
				validate: n => !!n.trim() || "name cannot be empty",
			},
			description: { type: "string", aliases: ["D"], optional: true },
			parentId: {
				type: "number",
				aliases: ["p"],
				optional: true,
			},
			difficulty: {
				type: "number",
				aliases: ["d"],
				validate: v => (v >= 1 && v <= 5) || "difficulty must be 1-5",
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("study-tracker/topics", []);
			const topic: Topic = {
				...params,
				id: nextId(store.data),
				parentId: params.parentId ?? null,
				boost: 0,
			};
			store.data.push(topic);
			sortAndUpdateStore(store);
			return topic;
		},
	});

	register({
		name: "study-tracker:list-topics",
		displayName: "List Study Topics",
		aliases: ["st:list-topics"],
		description: "List all topics, optionally sorted by priority score.",
		arguments: {
			scored: {
				type: "boolean",
				aliases: ["s"],
				optional: true,
				default: true,
			},
		},
		returnType: "list",
		execute({ scored }) {
			const topics = getStore("study-tracker/topics", []).data;
			const history = getStore("study-tracker/history", []).data;
			const result = topics.map(t => buildScoredTopic(t, history));
			return scored ? result.sort((a, b) => b.score - a.score) : result;
		},
	});

	register({
		name: "study-tracker:remove-topic",
		displayName: "Remove Study Topic",
		aliases: ["st:remove-topic"],
		description: "Remove a topic and all its children.",
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("study-tracker/topics", []);

			const toRemove = new Set<number>();
			const queue = [id];
			while (queue.length) {
				const cur = queue.shift()!;
				toRemove.add(cur);
				store.data
					.filter(t => t.parentId === cur)
					.forEach(t => queue.push(t.id));
			}

			const before = store.data.length;
			store.data = store.data.filter(t => !toRemove.has(t.id));
			if (store.data.length === before) throw "Topic not found";
			sortAndUpdateStore(store);
		},
	});

	register({
		name: "study-tracker:edit-topic",
		displayName: "Edit Study Topic",
		aliases: ["st:edit-topic"],
		description: "Edit a topic's fields.",
		arguments: {
			id: { type: "number" },
			name: {
				type: "string",
				aliases: ["n"],
				optional: true,
				validate: n => !!n.trim(),
			},
			description: { type: "string", aliases: ["D"], optional: true },
			parentId: { type: "number", aliases: ["p"], optional: true },
			difficulty: {
				type: "number",
				aliases: ["d"],
				optional: true,
				validate: v => (v >= 1 && v <= 5) || "1-5",
			},
		},
		returnType: "item",
		execute(params) {
			const store = getStore("study-tracker/topics", []);
			const topic = store.data.find(t => t.id === params.id);
			if (!topic) throw "Topic not found";

			if (params.name !== undefined) topic.name = params.name;
			if (params.description !== undefined)
				topic.description = params.description;
			if (params.parentId !== undefined) topic.parentId = params.parentId;
			if (params.difficulty !== undefined)
				topic.difficulty = params.difficulty;

			sortAndUpdateStore(store);
			return topic;
		},
	});

	register({
		name: "study-tracker:boost-topic",
		displayName: "Boost Topic Priority",
		aliases: ["st:boost"],
		description: "Increase a topic's priority score.",
		arguments: {
			topicId: { type: "number" },
			amount: {
				type: "number",
				validate: v => v >= 0 || "amount must be positive",
			},
		},
		returnType: "void",
		execute({ topicId, amount }) {
			const store = getStore("study-tracker/topics", []);
			const topic = store.data.find(t => t.id === topicId);
			if (!topic) throw `Topic ${topicId} not found`;
			topic.boost = amount;
			sortAndUpdateStore(store);
		},
	});

	register({
		name: "study-tracker:add-session",
		displayName: "Add Study Session Slot",
		aliases: ["st:add-session"],
		description: "Add a recurring weekly study slot.",
		arguments: {
			type: {
				type: "string",
				aliases: ["t"],
				description: '"static" | "dynamic"',
				validate: v =>
					["static", "dynamic"].includes(v) ||
					'must be "static" or "dynamic"',
			},
			day: {
				type: "number",
				aliases: ["d"],
				validate: v =>
					(v >= 0 && v <= 6) || "day must be 0 (Sun) – 6 (Sat)",
			},
			timeStart: {
				type: "string",
				aliases: ["s"],
				validate: v => /^\d{2}:\d{2}$/.test(v) || 'must be "HH:MM"',
			},
			timeEnd: {
				type: "string",
				aliases: ["e"],
				validate: v => /^\d{2}:\d{2}$/.test(v) || 'must be "HH:MM"',
			},
			topicId: { type: "number", aliases: ["T"], optional: true },
		},
		returnType: "item",
		execute(params) {
			if (params.type === "static" && params.topicId === undefined)
				throw "Static sessions require --topicId";

			const store = getStore("study-tracker/sessions", []);
			const session: Session = {
				id: nextId(store.data),
				type: params.type as "static" | "dynamic",
				day: params.day,
				timeStart: params.timeStart,
				timeEnd: params.timeEnd,
				...(params.topicId !== undefined && {
					topicId: params.topicId,
				}),
			};
			store.data.push(session);
			sortAndUpdateStore(store);
			return session;
		},
	});

	register({
		name: "study-tracker:list-sessions",
		displayName: "List Study Sessions",
		aliases: ["st:list-sessions"],
		description: "List your weekly study schedule.",
		arguments: {},
		returnType: "list",
		execute() {
			const topics = getStore("study-tracker/topics", []).data;
			const sessions = getStore("study-tracker/sessions", []).data;
			return sessions
				.sort(
					(a, b) =>
						a.day - b.day || a.timeStart.localeCompare(b.timeStart),
				)
				.map(({ topicId, ...s }) => ({
					...s,
					day: DAY_NAMES[s.day] ?? "" + s.day,
					topic:
						topicId !== undefined
							? (topics.find(t => t.id === topicId)?.name ??
								"" + topicId)
							: "-",
				}));
		},
	});

	register({
		name: "study-tracker:edit-session",
		displayName: "Edit Study Session Slot",
		aliases: ["st:edit-session"],
		description: "Edit a recurring weekly study slot.",
		arguments: {
			id: {
				type: "number",
			},
			type: {
				type: "string",
				aliases: ["t"],
				optional: true,
				validate: v =>
					["static", "dynamic"].includes(v) ||
					'must be "static" or "dynamic"',
			},
			day: {
				type: "number",
				aliases: ["d"],
				optional: true,
				validate: v =>
					(v >= 0 && v <= 6) || "day must be 0 (Sun) – 6 (Sat)",
			},
			timeStart: {
				type: "string",
				aliases: ["s"],
				optional: true,
				validate: v => /^\d{2}:\d{2}$/.test(v) || 'must be "HH:MM"',
			},
			timeEnd: {
				type: "string",
				aliases: ["e"],
				optional: true,
				validate: v => /^\d{2}:\d{2}$/.test(v) || 'must be "HH:MM"',
			},
			topicId: { type: "number", aliases: ["T"], optional: true },
		},
		returnType: "item",
		execute(params) {
			if (params.type === "static" && params.topicId === undefined)
				throw "Static sessions require --topicId";

			const store = getStore("study-tracker/sessions", []);
			const session = store.data.find(s => s.id === params.id);
			if (!session) throw "Session not found";

			if (params.type) session.type = params.type as "static" | "dynamic";
			if (params.day) session.day = params.day;
			if (params.timeStart) session.timeStart = params.timeStart;
			if (params.timeEnd) session.timeEnd = params.timeEnd;
			if (params.topicId) session.topicId = params.topicId;

			sortAndUpdateStore(store);
			return session;
		},
	});

	register({
		name: "study-tracker:remove-session",
		displayName: "Remove Study Session Slot",
		aliases: ["st:remove-session"],
		description: "Remove a recurring study slot by id.",
		arguments: { id: { type: "number" } },
		returnType: "void",
		execute({ id }) {
			const store = getStore("study-tracker/sessions", []);
			const filtered = store.data.filter(s => s.id !== id);
			if (filtered.length === store.data.length)
				throw "Session not found";
			store.data = filtered;
			sortAndUpdateStore(store);
		},
	});

	register({
		name: "study-tracker:log",
		displayName: "Log a Study Session",
		aliases: ["st:log"],
		description: "Record a completed study session for a topic.",
		arguments: {
			topicId: { type: "number", aliases: ["t"] },
			progress: {
				type: "number",
				aliases: ["p"],
				validate: v => (v >= 1 && v <= 5) || "progress must be 1-5",
			},
			note: { type: "string", aliases: ["n"], optional: true },
		},
		returnType: "item",
		execute(params) {
			const topicStore = getStore("study-tracker/topics", []);
			if (!topicStore.data.find(t => t.id === params.topicId))
				throw "Topic not found";

			topicStore.data.forEach(t => {
				t.boost *= 0.5;
			});
			sortAndUpdateStore(topicStore);

			const history = getStore("study-tracker/history", []);
			const entry: PastSession = {
				id: nextId(history.data),
				topicId: params.topicId,
				date: new Date(),
				progress: params.progress,
				...(params.note && { note: params.note }),
			};
			history.data.push(entry);
			sortAndUpdateStore(history);
			return entry;
		},
	});

	register({
		name: "study-tracker:history",
		displayName: "View Study History",
		aliases: ["st:history"],
		description: "View past study sessions, optionally filtered by topic.",
		arguments: {
			topicId: { type: "number", aliases: ["t"], optional: true },
		},
		returnType: "list",
		execute({ topicId }) {
			const topics = getStore("study-tracker/topics", []).data;
			const history = getStore("study-tracker/history", []).data;
			return history
				.filter(h => topicId === undefined || h.topicId === topicId)
				.sort(
					(a, b) =>
						new Date(b.date).getTime() - new Date(a.date).getTime(),
				)
				.map(({ topicId, ...h }) => ({
					...h,
					topic:
						topics.find(t => t.id === topicId)?.name ??
						"" + topicId,
					date: new Date(h.date),
				}));
		},
	});

	register({
		name: "study-tracker:recommend",
		displayName: "Get Study Recommendations",
		aliases: ["st:recommend"],
		description: "List topics ranked by priority score.",
		arguments: {
			count: {
				type: "number",
				aliases: ["n"],
				optional: true,
				default: 5,
			},
		},
		returnType: "list",
		execute({ count }) {
			const topics = getStore("study-tracker/topics", []).data;
			const history = getStore("study-tracker/history", []).data;
			return topics
				.map(t => buildScoredTopic(t, history))
				.sort((a, b) => b.score - a.score)
				.slice(0, count ?? 5);
		},
	});

	await emit("study-tracker:loaded");
}
