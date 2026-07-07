import { Store } from "@tanstack/store";
import type {
	BrokenRefMode,
	ExtractionDiagnostics,
	InputFormat,
	OpenApiSpec,
	OperationInfo,
	OutputFormat,
	TagOutputMode,
} from "#/lib/open-api-extractor";
import {
	extractOpenApi,
	listOperations,
	parseOpenApi,
} from "#/lib/open-api-extractor";

export interface ExtractorState {
	rawInput: string;
	parsedSpec: OpenApiSpec | null;
	inputFormat: InputFormat;
	operations: OperationInfo[];
	selectedKeys: string[]; // format: "METHOD path" (e.g. "GET /v1/users")
	outputFormat: OutputFormat;
	outputText: string;
	error: string | null;
	isExtracted: boolean;
	diagnostics: ExtractionDiagnostics | null;

	// Extraction options
	keepReferencedComponents: boolean;
	removeUnusedComponents: boolean;
	tagOutputMode: TagOutputMode;
	onBrokenRef: BrokenRefMode;
	removeExtensions: boolean;

	// Persistence States
	hydrationStatus: "idle" | "loading" | "done" | "cancelled";
	saveStatus: "idle" | "saving" | "saved" | "error";
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "openapi-extractor-state";
const CURRENT_VERSION = 1;

/** Fields that are serialisable and worth preserving across reloads. */
interface PersistedState {
	version: number;
	rawInput: string;
	selectedKeys: string[];
	outputFormat: OutputFormat;
	isExtracted: boolean;
	keepReferencedComponents: boolean;
	removeUnusedComponents: boolean;
	tagOutputMode: TagOutputMode;
	onBrokenRef: BrokenRefMode;
	removeExtensions: boolean;
}

function loadFromStorage(): Partial<PersistedState> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};

		if (parsed.version !== CURRENT_VERSION) {
			return {};
		}

		const result: Partial<PersistedState> = {};
		if (typeof parsed.rawInput === "string") {
			result.rawInput = parsed.rawInput;
		}
		if (
			Array.isArray(parsed.selectedKeys) &&
			parsed.selectedKeys.every((k: unknown) => typeof k === "string")
		) {
			result.selectedKeys = parsed.selectedKeys;
		}
		if (typeof parsed.outputFormat === "string") {
			result.outputFormat = parsed.outputFormat as OutputFormat;
		}
		if (typeof parsed.isExtracted === "boolean") {
			result.isExtracted = parsed.isExtracted;
		}
		if (typeof parsed.keepReferencedComponents === "boolean") {
			result.keepReferencedComponents = parsed.keepReferencedComponents;
		}
		if (typeof parsed.removeUnusedComponents === "boolean") {
			result.removeUnusedComponents = parsed.removeUnusedComponents;
		}
		if (typeof parsed.tagOutputMode === "string") {
			result.tagOutputMode = parsed.tagOutputMode as TagOutputMode;
		}
		if (typeof parsed.onBrokenRef === "string") {
			result.onBrokenRef = parsed.onBrokenRef as BrokenRefMode;
		}
		if (typeof parsed.removeExtensions === "boolean") {
			result.removeExtensions = parsed.removeExtensions;
		}

		return result;
	} catch {
		return {};
	}
}

function saveToStorage(state: ExtractorState) {
	try {
		const persisted: PersistedState = {
			version: CURRENT_VERSION,
			rawInput: state.rawInput,
			selectedKeys: state.selectedKeys,
			outputFormat: state.outputFormat,
			isExtracted: state.isExtracted,
			keepReferencedComponents: state.keepReferencedComponents,
			removeUnusedComponents: state.removeUnusedComponents,
			tagOutputMode: state.tagOutputMode,
			onBrokenRef: state.onBrokenRef,
			removeExtensions: state.removeExtensions,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
		extractorStore.setState((prev) => ({ ...prev, saveStatus: "saved" }));
	} catch {
		extractorStore.setState((prev) => ({ ...prev, saveStatus: "error" }));
	}
}

function getFingerprint(state: ExtractorState): string {
	const persisted = {
		rawInput: state.rawInput,
		selectedKeys: state.selectedKeys,
		outputFormat: state.outputFormat,
		isExtracted: state.isExtracted,
		keepReferencedComponents: state.keepReferencedComponents,
		removeUnusedComponents: state.removeUnusedComponents,
		tagOutputMode: state.tagOutputMode,
		onBrokenRef: state.onBrokenRef,
		removeExtensions: state.removeExtensions,
	};
	return JSON.stringify(persisted);
}

let lastSavedFingerprint = "";
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(state: ExtractorState) {
	if (state.hydrationStatus === "idle" || state.hydrationStatus === "loading") {
		return;
	}

	const currentFingerprint = getFingerprint(state);
	if (currentFingerprint === lastSavedFingerprint) {
		return;
	}

	extractorStore.setState((prev) => ({ ...prev, saveStatus: "saving" }));

	if (saveTimer !== null) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		saveToStorage(extractorStore.state);
		lastSavedFingerprint = currentFingerprint;
		saveTimer = null;
	}, 300);
}

// ─── Hydration ────────────────────────────────────────────────────────────────

function buildInitialState(): ExtractorState {
	return {
		...emptyState,
		hydrationStatus: "idle",
	};
}

const emptyState: ExtractorState = {
	rawInput: "",
	parsedSpec: null,
	inputFormat: "json",
	operations: [],
	selectedKeys: [],
	outputFormat: "json",
	outputText: "",
	error: null,
	isExtracted: false,
	diagnostics: null,
	keepReferencedComponents: true,
	removeUnusedComponents: true,
	tagOutputMode: "used",
	onBrokenRef: "warn",
	removeExtensions: false,
	hydrationStatus: "done",
	saveStatus: "idle",
};

const initialStoreState: ExtractorState = buildInitialState();
lastSavedFingerprint = getFingerprint(initialStoreState);

export const extractorStore = new Store<ExtractorState>(initialStoreState);

// Subscribe and persist after every state change
extractorStore.subscribe(() => {
	scheduleSave(extractorStore.state);
});

export const actions = {
	async hydrateFromStorage(signal: AbortSignal) {
		const saved = loadFromStorage();
		if (!saved.rawInput?.trim()) {
			extractorStore.setState((s) => ({
				...s,
				hydrationStatus: "done",
			}));
			return;
		}

		extractorStore.setState((s) => ({
			...s,
			...saved,
			hydrationStatus: "loading",
		}));

		try {
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					if (signal.aborted) {
						reject(new DOMException("Aborted", "AbortError"));
						return;
					}
					resolve();
				}, 50);
				signal.addEventListener("abort", () => {
					clearTimeout(timeout);
					reject(new DOMException("Aborted", "AbortError"));
				});
			});

			const { spec, inputFormat } = parseOpenApi(saved.rawInput);
			const operations = listOperations(spec);

			if (signal.aborted) {
				throw new DOMException("Aborted", "AbortError");
			}

			const validKeys = new Set(
				operations.map((op) => `${op.method} ${op.path}`),
			);
			const newSelectedKeys = (saved.selectedKeys || []).filter((k) =>
				validKeys.has(k),
			);
			const selectionShrank =
				newSelectedKeys.length !== (saved.selectedKeys || []).length;

			let isExtracted = saved.isExtracted || false;
			let outputText = "";
			let diagnostics: ExtractionDiagnostics | null = null;
			let error: string | null = null;

			if (selectionShrank) {
				isExtracted = false;
			} else if (isExtracted && newSelectedKeys.length > 0) {
				try {
					const keepRules = newSelectedKeys.map((key) => {
						const [method, path] = key.split(" ");
						return {
							path,
							method: method.toLowerCase(),
						};
					});

					const result = extractOpenApi(spec, {
						keep: keepRules,
						outputFormat:
							saved.outputFormat === "same-as-input"
								? "json"
								: (saved.outputFormat as "json" | "yaml"),
						keepReferencedComponents: saved.keepReferencedComponents ?? true,
						removeUnusedComponents: saved.removeUnusedComponents ?? true,
						tagOutputMode: saved.tagOutputMode ?? "used",
						onBrokenRef: saved.onBrokenRef ?? "warn",
						removeExtensions: saved.removeExtensions ?? false,
					});

					outputText = result.text;
					diagnostics = result.diagnostics;
				} catch (err) {
					isExtracted = false;
					error =
						err instanceof Error
							? err.message
							: "Failed to restore extracted output.";
				}
			}

			extractorStore.setState((s) => ({
				...s,
				parsedSpec: spec,
				inputFormat,
				operations,
				selectedKeys: newSelectedKeys,
				isExtracted,
				outputText,
				diagnostics,
				error,
				hydrationStatus: "done",
			}));
		} catch (err: unknown) {
			const errorName = err instanceof Error ? err.name : "";
			if (errorName === "AbortError") {
				extractorStore.setState(() => ({
					...emptyState,
					hydrationStatus: "cancelled",
				}));
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch {
					// ignore
				}
				lastSavedFingerprint = getFingerprint(extractorStore.state);
				return;
			}

			extractorStore.setState((s) => ({
				...s,
				parsedSpec: null,
				operations: [],
				selectedKeys: [],
				isExtracted: false,
				outputText: "",
				diagnostics: null,
				hydrationStatus: "done",
			}));
		} finally {
			lastSavedFingerprint = getFingerprint(extractorStore.state);
		}
	},

	clearSaveStatus() {
		extractorStore.setState((s) => {
			if (s.saveStatus === "saved" || s.saveStatus === "error") {
				return { ...s, saveStatus: "idle" };
			}
			return s;
		});
	},

	setInputText(text: string) {
		extractorStore.setState((state) => ({
			...state,
			rawInput: text,
			error: null,
		}));
	},

	setInputFormat(format: InputFormat) {
		extractorStore.setState((state) => ({
			...state,
			inputFormat: format,
		}));
	},

	setOutputFormat(format: OutputFormat) {
		extractorStore.setState((state) => ({
			...state,
			outputFormat: format,
		}));
	},

	loadSpec() {
		const { rawInput } = extractorStore.state;
		if (!rawInput.trim()) {
			extractorStore.setState((state) => ({
				...state,
				error: "Please enter or upload an OpenAPI specification.",
			}));
			return false;
		}

		try {
			const { spec, inputFormat } = parseOpenApi(rawInput);
			const operations = listOperations(spec);

			// Auto select all operations by default when loading a new spec
			const selectedKeys = operations.map((op) => `${op.method} ${op.path}`);

			extractorStore.setState((state) => ({
				...state,
				parsedSpec: spec,
				inputFormat,
				operations,
				selectedKeys,
				error: null,
				isExtracted: false,
				outputText: "",
				diagnostics: null,
			}));
			return true;
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to parse OpenAPI document. Make sure it's valid JSON or YAML.";
			extractorStore.setState((state) => ({
				...state,
				error: message,
				parsedSpec: null,
				operations: [],
				selectedKeys: [],
			}));
			return false;
		}
	},

	toggleOperation(method: string, path: string) {
		const key = `${method.toUpperCase()} ${path}`;
		extractorStore.setState((state) => {
			const selectedKeys = state.selectedKeys.includes(key)
				? state.selectedKeys.filter((k) => k !== key)
				: [...state.selectedKeys, key];
			return { ...state, selectedKeys };
		});
	},

	selectAll() {
		extractorStore.setState((state) => {
			const selectedKeys = state.operations.map(
				(op) => `${op.method} ${op.path}`,
			);
			return { ...state, selectedKeys };
		});
	},

	deselectAll() {
		extractorStore.setState((state) => ({
			...state,
			selectedKeys: [],
		}));
	},

	selectByTag(tag: string, select = true) {
		extractorStore.setState((state) => {
			const targetKeys = state.operations
				.filter((op) => op.tags.includes(tag))
				.map((op) => `${op.method} ${op.path}`);

			const newKeys = select
				? [...new Set([...state.selectedKeys, ...targetKeys])]
				: state.selectedKeys.filter((key) => !targetKeys.includes(key));

			return { ...state, selectedKeys: newKeys };
		});
	},

	setOption<K extends keyof ExtractorState>(key: K, value: ExtractorState[K]) {
		extractorStore.setState((state) => ({
			...state,
			[key]: value,
		}));
	},

	extract() {
		const {
			parsedSpec,
			selectedKeys,
			outputFormat,
			keepReferencedComponents,
			removeUnusedComponents,
			tagOutputMode,
			onBrokenRef,
			removeExtensions,
		} = extractorStore.state;

		if (!parsedSpec) {
			extractorStore.setState((state) => ({
				...state,
				error: "No OpenAPI specification is loaded.",
			}));
			return;
		}

		if (selectedKeys.length === 0) {
			extractorStore.setState((state) => ({
				...state,
				error: "Please select at least one operation to extract.",
			}));
			return;
		}

		try {
			// Convert selectedKeys back to EndpointRule array
			const keepRules = selectedKeys.map((key) => {
				const [method, path] = key.split(" ");
				return {
					path,
					method: method.toLowerCase(),
				};
			});

			const result = extractOpenApi(parsedSpec, {
				keep: keepRules,
				outputFormat:
					outputFormat === "same-as-input"
						? "json"
						: (outputFormat as "json" | "yaml"),
				keepReferencedComponents,
				removeUnusedComponents,
				tagOutputMode,
				onBrokenRef,
				removeExtensions,
			});

			extractorStore.setState((state) => ({
				...state,
				outputText: result.text,
				diagnostics: result.diagnostics,
				isExtracted: true,
				error: null,
			}));
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "An error occurred during extraction.";
			extractorStore.setState((state) => ({
				...state,
				error: message,
			}));
		}
	},

	backToSelection() {
		extractorStore.setState((state) => ({
			...state,
			isExtracted: false,
			outputText: "",
			diagnostics: null,
			error: null,
		}));
	},

	/**
	 * Go back to spec input, keeping the raw text editable.
	 * Clears the parsed spec/operations so SpecInput is shown again.
	 */
	backToInput() {
		extractorStore.setState((state) => ({
			...state,
			parsedSpec: null,
			operations: [],
			selectedKeys: [],
			isExtracted: false,
			outputText: "",
			diagnostics: null,
			error: null,
		}));
	},

	/**
	 * Permanently remove a path+method from the loaded operations list.
	 * Different from deselect — removes it entirely from the pool.
	 */
	removeOperation(method: string, path: string) {
		const key = `${method.toUpperCase()} ${path}`;
		extractorStore.setState((state) => ({
			...state,
			operations: state.operations.filter(
				(op) => `${op.method.toUpperCase()} ${op.path}` !== key,
			),
			selectedKeys: state.selectedKeys.filter((k) => k !== key),
		}));
	},

	/**
	 * Permanently remove ALL methods for a given path from the operations list.
	 */
	removePath(path: string) {
		extractorStore.setState((state) => ({
			...state,
			operations: state.operations.filter((op) => op.path !== path),
			selectedKeys: state.selectedKeys.filter((k) => !k.endsWith(` ${path}`)),
		}));
	},

	/**
	 * Permanently remove all operations that belong to a given tag.
	 * "Default (No Tag)" removes all operations with no tags.
	 */
	removeTag(tag: string) {
		const isDefault = tag === "Default (No Tag)";
		extractorStore.setState((state) => {
			const toRemove = new Set(
				state.operations
					.filter((op) =>
						isDefault ? op.tags.length === 0 : op.tags.includes(tag),
					)
					.map((op) => `${op.method.toUpperCase()} ${op.path}`),
			);
			return {
				...state,
				operations: state.operations.filter(
					(op) => !toRemove.has(`${op.method.toUpperCase()} ${op.path}`),
				),
				selectedKeys: state.selectedKeys.filter((k) => !toRemove.has(k)),
			};
		});
	},

	reset() {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
		extractorStore.setState(() => emptyState);
		lastSavedFingerprint = getFingerprint(emptyState);
	},
};
