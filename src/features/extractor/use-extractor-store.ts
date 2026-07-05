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
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "openapi-extractor-state";

/** Fields that are serialisable and worth preserving across reloads. */
type PersistedState = Pick<
  ExtractorState,
  | "rawInput"
  | "inputFormat"
  | "selectedKeys"
  | "outputFormat"
  | "outputText"
  | "isExtracted"
  | "diagnostics"
  | "keepReferencedComponents"
  | "removeUnusedComponents"
  | "tagOutputMode"
  | "onBrokenRef"
  | "removeExtensions"
>;

function loadFromStorage(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function saveToStorage(state: ExtractorState) {
  try {
    const persisted: PersistedState = {
      rawInput: state.rawInput,
      inputFormat: state.inputFormat,
      selectedKeys: state.selectedKeys,
      outputFormat: state.outputFormat,
      outputText: state.outputText,
      isExtracted: state.isExtracted,
      diagnostics: state.diagnostics,
      keepReferencedComponents: state.keepReferencedComponents,
      removeUnusedComponents: state.removeUnusedComponents,
      tagOutputMode: state.tagOutputMode,
      onBrokenRef: state.onBrokenRef,
      removeExtensions: state.removeExtensions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // storage quota exceeded or unavailable — silently ignore
  }
}

/** Debounce saves so rapid keystrokes don't thrash localStorage with large payloads. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(state: ExtractorState) {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToStorage(state);
    saveTimer = null;
  }, 300);
}

// ─── Hydration ────────────────────────────────────────────────────────────────

function buildInitialState(): ExtractorState {
  const saved = loadFromStorage();

  const base: ExtractorState = {
    ...{
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
    },
    ...saved,
    // Always reset transient fields
    parsedSpec: null,
    operations: [],
    error: null,
  };

  // Re-derive parsedSpec and operations from saved rawInput
  if (base.rawInput.trim()) {
    try {
      const { spec, inputFormat } = parseOpenApi(base.rawInput);
      const operations = listOperations(spec);
      base.parsedSpec = spec;
      base.inputFormat = inputFormat;
      base.operations = operations;

      // Validate that persisted selectedKeys still exist in the re-parsed spec
      const validKeys = new Set(operations.map(op => `${op.method} ${op.path}`));
      base.selectedKeys = base.selectedKeys.filter(k => validKeys.has(k));
    } catch {
      // Saved input is no longer valid — keep rawInput so user can see/fix it
      base.isExtracted = false;
      base.outputText = "";
      base.diagnostics = null;
    }
  }

  return base;
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
};

const initialStoreState: ExtractorState = buildInitialState();

export const extractorStore = new Store<ExtractorState>(initialStoreState);

// Subscribe and persist after every state change
extractorStore.subscribe(() => {
  scheduleSave(extractorStore.state);
});

// Actions/Helpers to mutate state
export const actions = {
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
			selectedKeys: state.selectedKeys.filter(
				(k) => !k.endsWith(` ${path}`),
			),
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
						isDefault
							? op.tags.length === 0
							: op.tags.includes(tag),
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
	},
};
