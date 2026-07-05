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

const initialStoreState: ExtractorState = {
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

export const extractorStore = new Store<ExtractorState>(initialStoreState);

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

	reset() {
		extractorStore.setState(() => initialStoreState);
	},
};
