/* biome-ignore-all lint/suspicious/noExplicitAny: core library needs generic any */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type OpenApiSpec = Record<string, any>;

export type InputFormat = "json" | "yaml" | "object";
export type OutputFormat = "json" | "yaml" | "same-as-input";

export type BrokenRefMode = "warn" | "error" | "ignore";

export type TagOutputMode = "used" | "all" | "none";

export type HttpMethod =
	| "get"
	| "put"
	| "post"
	| "delete"
	| "options"
	| "head"
	| "patch"
	| "trace";

export type EndpointRule = {
	/**
	 * Exact OpenAPI path.
	 * Example: "/v1/users/{id}"
	 */
	path?: string;

	/**
	 * Regex pattern for path matching.
	 * Example: "^/v1/public/"
	 */
	pathRegex?: string | RegExp;

	/**
	 * Exact HTTP method.
	 * Example: "get"
	 */
	method?: HttpMethod | string;

	/**
	 * Multiple accepted HTTP methods.
	 * Example: ["get", "post"]
	 */
	methods?: Array<HttpMethod | string>;

	/**
	 * Exact operation tag.
	 * Example: "Auth"
	 */
	tag?: string;

	/**
	 * Regex pattern for operation tags.
	 * Example: "^Admin"
	 */
	tagRegex?: string | RegExp;

	/**
	 * Exact operationId.
	 * Example: "login"
	 */
	operationId?: string;

	/**
	 * Regex pattern for operationId.
	 * Example: "^admin"
	 */
	operationIdRegex?: string | RegExp;

	/**
	 * Regex pattern for operation summary.
	 */
	summaryRegex?: string | RegExp;

	/**
	 * Regex pattern for operation description.
	 */
	descriptionRegex?: string | RegExp;
};

export type ExtractOptions = {
	/**
	 * Rules for operations to keep.
	 *
	 * If empty or omitted, all operations are kept first,
	 * then `remove` rules are applied.
	 */
	keep?: EndpointRule[];

	/**
	 * Rules for operations to remove.
	 *
	 * Remove wins over keep.
	 */
	remove?: EndpointRule[];

	/**
	 * Force-keep arbitrary JSON Pointer locations.
	 *
	 * Examples:
	 * - "/info"
	 * - "/servers/0"
	 * - "/components/schemas/User"
	 * - "/components/securitySchemes/bearerAuth"
	 */
	keepPointers?: string[];

	/**
	 * Remove arbitrary JSON Pointer locations.
	 *
	 * Examples:
	 * - "/components/schemas/AdminUser"
	 * - "/servers/1"
	 * - "/components/examples/InternalExample"
	 */
	removePointers?: string[];

	/**
	 * Output format.
	 *
	 * Default: "same-as-input"
	 */
	outputFormat?: OutputFormat;

	/**
	 * Automatically copy components referenced by kept operations.
	 *
	 * Default: true
	 */
	keepReferencedComponents?: boolean;

	/**
	 * Remove components not reachable from kept operations.
	 *
	 * Default: true
	 */
	removeUnusedComponents?: boolean;

	/**
	 * What to do when the final output still contains broken local $ref.
	 *
	 * Default: "warn"
	 */
	onBrokenRef?: BrokenRefMode;

	/**
	 * How to output top-level OpenAPI tags.
	 *
	 * - "used": keep only tags used by kept operations
	 * - "all": keep all original tags
	 * - "none": remove top-level tags
	 *
	 * Default: "used"
	 */
	tagOutputMode?: TagOutputMode;

	/**
	 * Root keys to preserve before paths/components are rebuilt.
	 *
	 * Default keeps common metadata:
	 * openapi, jsonSchemaDialect, info, servers, externalDocs, security
	 */
	rootKeys?: string[];

	/**
	 * Remove OpenAPI extension fields.
	 *
	 * - false: keep all x-* fields
	 * - true: remove all x-* fields
	 * - string[]: remove only listed extension keys
	 *
	 * Examples:
	 * removeExtensions: true
	 * removeExtensions: ["x-internal", "x-admin-only"]
	 *
	 * Default: false
	 */
	removeExtensions?: boolean | string[];

	/**
	 * If true, extraction still happens, but returned text is empty.
	 * Useful for GUI preview.
	 *
	 * Default: false
	 */
	dryRun?: boolean;
};

export type OperationInfo = {
	method: string;
	path: string;
	operationId?: string;
	tags: string[];
	summary?: string;
	description?: string;
};

export type ComponentInfo = {
	pointer: string;
	group: string;
	name: string;
	referencedBy: string[];
	referenced: boolean;
};

export type RefIssue = {
	ref: string;
	location: string;
	message: string;
};

export type PointerIssue = {
	pointer: string;
	message: string;
};

export type ExtractionDiagnostics = {
	inputFormat: InputFormat;
	outputFormat: Exclude<OutputFormat, "same-as-input">;
	keptOperations: OperationInfo[];
	removedOperations: Array<OperationInfo & { reason: string }>;
	keptComponents: ComponentInfo[];
	warnings: string[];
	brokenRefs: RefIssue[];
	unresolvedRefs: RefIssue[];
	pointerIssues: PointerIssue[];
	componentCounts: Record<string, number>;
};

export type ExtractResult = {
	spec: OpenApiSpec;
	text: string;
	diagnostics: ExtractionDiagnostics;
};

const HTTP_METHODS = new Set<HttpMethod>([
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
]);

const DEFAULT_ROOT_KEYS = [
	"openapi",
	"jsonSchemaDialect",
	"info",
	"servers",
	"externalDocs",
	"security",
];

/**
 * Main convenience function.
 *
 * Accepts YAML text, JSON text, or an already parsed OpenAPI object.
 * Returns extracted spec object, output text, and diagnostics.
 */
export function extractOpenApi(
	input: string | OpenApiSpec,
	options: ExtractOptions = {},
): ExtractResult {
	const parsed = parseOpenApi(input);
	const spec = extractOpenApiObject(parsed.spec, options, parsed.inputFormat);

	const outputFormat = resolveOutputFormat(
		options.outputFormat,
		parsed.inputFormat,
	);
	const text = options.dryRun ? "" : stringifyOpenApi(spec.spec, outputFormat);

	return {
		spec: spec.spec,
		text,
		diagnostics: spec.diagnostics,
	};
}

/**
 * Parse YAML/JSON/object OpenAPI input.
 */
export function parseOpenApi(input: string | OpenApiSpec): {
	spec: OpenApiSpec;
	inputFormat: InputFormat;
} {
	if (typeof input !== "string") {
		return {
			spec: deepClone(input),
			inputFormat: "object",
		};
	}

	const text = input.trim();

	if (!text) {
		throw new Error("OpenAPI input is empty.");
	}

	if (text.startsWith("{") || text.startsWith("[")) {
		try {
			return {
				spec: JSON.parse(text),
				inputFormat: "json",
			};
		} catch {
			// JSON-looking input may still be invalid JSON.
			// Fall back to YAML parser because YAML is more permissive.
		}
	}

	return {
		spec: parseYaml(text),
		inputFormat: "yaml",
	};
}

/**
 * Convert OpenAPI object to JSON or YAML text.
 */
export function stringifyOpenApi(
	spec: OpenApiSpec,
	format: "json" | "yaml",
): string {
	if (format === "json") {
		return `${JSON.stringify(spec, null, 2)}\n`;
	}

	return stringifyYaml(spec, {
		singleQuote: false,
		lineWidth: 120,
	});
}

/**
 * Extract subset from an already parsed OpenAPI object.
 */
export function extractOpenApiObject(
	source: OpenApiSpec,
	options: ExtractOptions = {},
	inputFormat: InputFormat = "object",
): {
	spec: OpenApiSpec;
	diagnostics: ExtractionDiagnostics;
} {
	if (!isRecord(source) || !source.openapi || !source.paths) {
		throw new Error(
			"Input does not look like an OpenAPI document. Missing `openapi` or `paths`.",
		);
	}

	const keep = options.keep ?? [];
	const remove = options.remove ?? [];
	const keepPointers = normalizePointers(options.keepPointers ?? []);
	const removePointers = normalizePointers(options.removePointers ?? []);
	const keepReferencedComponents = options.keepReferencedComponents ?? true;
	const removeUnusedComponents = options.removeUnusedComponents ?? true;
	const onBrokenRef = options.onBrokenRef ?? "warn";
	const tagOutputMode = options.tagOutputMode ?? "used";
	const rootKeys = options.rootKeys ?? DEFAULT_ROOT_KEYS;

	const warnings: string[] = [];
	const pointerIssues: PointerIssue[] = [];
	const unresolvedRefs: RefIssue[] = [];

	const output: OpenApiSpec = {};

	for (const key of rootKeys) {
		if (source[key] !== undefined) {
			output[key] = deepClone(source[key]);
		}
	}

	output.paths = {};

	const keptOperations: OperationInfo[] = [];
	const removedOperations: Array<OperationInfo & { reason: string }> = [];

	const shouldKeepAllInitially = keep.length === 0;

	for (const [path, pathItem] of Object.entries(source.paths ?? {})) {
		if (!isRecord(pathItem)) continue;

		const outputPathItem = copyPathItemMetadata(pathItem);

		for (const [rawMethod, operation] of Object.entries(pathItem)) {
			const method = rawMethod.toLowerCase();

			if (!isHttpMethod(method)) continue;
			if (!isRecord(operation)) continue;

			const ctx = {
				path,
				method,
				operation,
				pathItem,
			};

			const keepMatched =
				shouldKeepAllInitially ||
				keep.some((rule) => matchesEndpointRule(rule, ctx));
			const removeMatched = remove.some((rule) =>
				matchesEndpointRule(rule, ctx),
			);

			const info = operationInfo(path, method, operation);

			if (!keepMatched) {
				removedOperations.push({
					...info,
					reason: "not_matched_by_keep_rules",
				});
				continue;
			}

			if (removeMatched) {
				removedOperations.push({
					...info,
					reason: "matched_by_remove_rules",
				});
				continue;
			}

			outputPathItem[method] = deepClone(operation);
			keptOperations.push(info);
		}

		if (pathItemHasOperations(outputPathItem)) {
			output.paths[path] = outputPathItem;
		}
	}

	if (tagOutputMode !== "none") {
		const tags = buildTopLevelTags(source, output, tagOutputMode);
		if (tags.length) output.tags = tags;
	}

	if (keepReferencedComponents) {
		const collected = collectReferencedComponents(source, output);
		output.components = mergeDeep(
			output.components ?? {},
			collected.components,
		);

		warnings.push(...collected.warnings);
		unresolvedRefs.push(...collected.unresolvedRefs);
	} else if (!removeUnusedComponents && source.components) {
		output.components = deepClone(source.components);
	}

	addUsedSecuritySchemes(source, output);

	for (const pointer of keepPointers) {
		const value = getByPointer(source, pointer);

		if (value === undefined) {
			pointerIssues.push({
				pointer,
				message: `keepPointer does not exist in source: ${pointer}`,
			});
			continue;
		}

		setByPointer(output, pointer, deepClone(value));
	}

	/**
	 * Run referenced-component collection again after keepPointers,
	 * because manually kept objects may contain additional $ref.
	 */
	if (keepReferencedComponents) {
		const collected = collectReferencedComponents(source, output);
		output.components = mergeDeep(
			output.components ?? {},
			collected.components,
		);

		warnings.push(...collected.warnings);
		unresolvedRefs.push(...collected.unresolvedRefs);
	}

	for (const pointer of removePointers) {
		const deleted = deleteByPointer(output, pointer);

		if (!deleted) {
			pointerIssues.push({
				pointer,
				message: `removePointer did not match anything in output: ${pointer}`,
			});
		}
	}

	applyExtensionRemoval(output, options.removeExtensions ?? false);

	if (removeUnusedComponents) {
		pruneUnusedComponents(output, {
			keepPointers,
		});
	}

	removeEmptyContainers(output);

	const brokenRefs = findBrokenLocalRefs(output);

	if (brokenRefs.length) {
		const message = `${brokenRefs.length} broken local $ref found after extraction.`;

		if (onBrokenRef === "error") {
			const details = brokenRefs
				.map((issue) => `${issue.ref} at ${issue.location}`)
				.join("\n");
			throw new Error(`${message}\n${details}`);
		}

		if (onBrokenRef === "warn") {
			warnings.push(message);
		}
	}

	const keptComponents = listComponents(output);

	return {
		spec: output,
		diagnostics: {
			inputFormat,
			outputFormat: resolveOutputFormat(options.outputFormat, inputFormat),
			keptOperations,
			removedOperations,
			keptComponents,
			warnings,
			brokenRefs,
			unresolvedRefs,
			pointerIssues,
			componentCounts: countComponents(output.components),
		},
	};
}

/**
 * GUI helper.
 *
 * Lists all operations from an OpenAPI file/object.
 * Useful for building endpoint checkboxes.
 */
export function listOperations(input: string | OpenApiSpec): OperationInfo[] {
	const { spec } = parseOpenApi(input);
	const operations: OperationInfo[] = [];

	forEachOperation(spec.paths ?? {}, ({ path, method, operation }) => {
		operations.push(operationInfo(path, method, operation));
	});

	return operations;
}

/**
 * GUI helper.
 *
 * Lists all components and who references them.
 * Useful for building component trees and warning panels.
 */
export function listComponents(input: string | OpenApiSpec): ComponentInfo[] {
	const { spec } =
		typeof input === "string" ? parseOpenApi(input) : { spec: input };
	const refs = collectRefsWithLocations(spec);
	const referencedByMap = new Map<string, string[]>();

	for (const item of refs) {
		if (!item.ref.startsWith("#/components/")) continue;

		const pointer = normalizePointer(item.ref);
		const current = referencedByMap.get(pointer) ?? [];

		current.push(item.location);
		referencedByMap.set(pointer, current);
	}

	const components = spec.components;

	if (!isRecord(components)) return [];

	const result: ComponentInfo[] = [];

	for (const [group, values] of Object.entries(components)) {
		if (!isRecord(values)) continue;

		for (const name of Object.keys(values)) {
			const pointer = `/components/${escapePointerPart(group)}/${escapePointerPart(name)}`;
			const referencedBy = referencedByMap.get(pointer) ?? [];

			result.push({
				pointer,
				group,
				name,
				referencedBy,
				referenced: referencedBy.length > 0,
			});
		}
	}

	return result;
}

function matchesEndpointRule(
	rule: EndpointRule,
	ctx: {
		path: string;
		method: string;
		operation: OpenApiSpec;
		pathItem: OpenApiSpec;
	},
): boolean {
	if (!rule || !isRecord(rule)) return false;

	if (rule.path && ctx.path !== rule.path) {
		return false;
	}

	if (rule.pathRegex && !toRegex(rule.pathRegex).test(ctx.path)) {
		return false;
	}

	if (rule.method && ctx.method !== String(rule.method).toLowerCase()) {
		return false;
	}

	if (rule.methods?.length) {
		const methods = rule.methods.map((method) => String(method).toLowerCase());

		if (!methods.includes(ctx.method)) return false;
	}

	if (rule.tag) {
		const tags = Array.isArray(ctx.operation.tags) ? ctx.operation.tags : [];

		if (!tags.includes(rule.tag)) return false;
	}

	if (rule.tagRegex) {
		const regex = toRegex(rule.tagRegex);
		const tags = Array.isArray(ctx.operation.tags) ? ctx.operation.tags : [];

		if (!tags.some((tag) => regex.test(String(tag)))) return false;
	}

	if (rule.operationId && ctx.operation.operationId !== rule.operationId) {
		return false;
	}

	if (rule.operationIdRegex) {
		const operationId = String(ctx.operation.operationId ?? "");

		if (!toRegex(rule.operationIdRegex).test(operationId)) return false;
	}

	if (rule.summaryRegex) {
		const summary = String(ctx.operation.summary ?? "");

		if (!toRegex(rule.summaryRegex).test(summary)) return false;
	}

	if (rule.descriptionRegex) {
		const description = String(ctx.operation.description ?? "");

		if (!toRegex(rule.descriptionRegex).test(description)) return false;
	}

	return Boolean(
		rule.path ||
			rule.pathRegex ||
			rule.method ||
			rule.methods?.length ||
			rule.tag ||
			rule.tagRegex ||
			rule.operationId ||
			rule.operationIdRegex ||
			rule.summaryRegex ||
			rule.descriptionRegex,
	);
}

function collectReferencedComponents(
	source: OpenApiSpec,
	seed: OpenApiSpec,
): {
	components: OpenApiSpec;
	warnings: string[];
	unresolvedRefs: RefIssue[];
} {
	const components: OpenApiSpec = {};
	const warnings: string[] = [];
	const unresolvedRefs: RefIssue[] = [];

	const pending = collectRefsWithLocations(seed);
	const seenRefs = new Set<string>();

	while (pending.length) {
		const current = pending.shift();
		if (!current) continue;

		const { ref, location } = current;

		if (!ref.startsWith("#/components/")) {
			continue;
		}

		if (seenRefs.has(ref)) {
			continue;
		}

		seenRefs.add(ref);

		const pointer = normalizePointer(ref);
		const value = getByPointer(source, pointer);

		if (value === undefined) {
			const issue: RefIssue = {
				ref,
				location,
				message: `Could not resolve local component ref: ${ref}`,
			};

			unresolvedRefs.push(issue);
			warnings.push(issue.message);
			continue;
		}

		setByPointer({ components }, pointer, deepClone(value));

		for (const nestedRef of collectRefsWithLocations(value, pointer)) {
			if (!seenRefs.has(nestedRef.ref)) {
				pending.push(nestedRef);
			}
		}
	}

	return {
		components,
		warnings,
		unresolvedRefs,
	};
}

function pruneUnusedComponents(
	output: OpenApiSpec,
	options: {
		keepPointers: string[];
	},
): void {
	if (!isRecord(output.components)) return;

	const pinnedComponentPointers = options.keepPointers.filter((pointer) =>
		pointer.startsWith("/components/"),
	);

	const rootWithoutComponents = deepClone(output);
	delete rootWithoutComponents.components;

	const pendingRefs = collectRefsWithLocations(rootWithoutComponents)
		.filter((item) => item.ref.startsWith("#/components/"))
		.map((item) => item.ref);

	for (const securitySchemePointer of usedSecuritySchemePointers(output)) {
		pendingRefs.push(pointerToRef(securitySchemePointer));
	}

	const reachable = new Set<string>();
	const pending = [...new Set(pendingRefs)];

	while (pending.length) {
		const ref = pending.shift();
		if (!ref) continue;

		const pointer = normalizePointer(ref);

		if (!pointer.startsWith("/components/")) {
			continue;
		}

		if (reachable.has(pointer)) {
			continue;
		}

		reachable.add(pointer);

		const value = getByPointer(output, pointer);

		if (value === undefined) {
			continue;
		}

		for (const nestedRef of collectRefsWithLocations(value, pointer)) {
			if (nestedRef.ref.startsWith("#/components/")) {
				pending.push(nestedRef.ref);
			}
		}
	}

	for (const [group, values] of Object.entries(output.components)) {
		if (!isRecord(values)) continue;

		for (const name of Object.keys(values)) {
			const pointer = `/components/${escapePointerPart(group)}/${escapePointerPart(name)}`;
			const pinned = pinnedComponentPointers.some((pinnedPointer) => {
				return (
					pointer === pinnedPointer ||
					pointer.startsWith(`${pinnedPointer}/`) ||
					pinnedPointer.startsWith(`${pointer}/`)
				);
			});

			if (!reachable.has(pointer) && !pinned) {
				delete values[name];
			}
		}
	}

	removeEmptyContainers(output);
}

function addUsedSecuritySchemes(
	source: OpenApiSpec,
	output: OpenApiSpec,
): void {
	const sourceSecuritySchemes = source.components?.securitySchemes;

	if (!isRecord(sourceSecuritySchemes)) return;

	const usedNames = new Set<string>();

	function collect(security: unknown): void {
		if (!Array.isArray(security)) return;

		for (const requirement of security) {
			if (!isRecord(requirement)) continue;

			for (const name of Object.keys(requirement)) {
				usedNames.add(name);
			}
		}
	}

	collect(output.security);

	forEachOperation(output.paths ?? {}, ({ operation }) => {
		collect(operation.security);
	});

	if (!usedNames.size) return;

	output.components ??= {};
	output.components.securitySchemes ??= {};

	for (const name of usedNames) {
		if (sourceSecuritySchemes[name] !== undefined) {
			output.components.securitySchemes[name] = deepClone(
				sourceSecuritySchemes[name],
			);
		}
	}
}

function usedSecuritySchemePointers(spec: OpenApiSpec): string[] {
	const usedNames = new Set<string>();

	function collect(security: unknown): void {
		if (!Array.isArray(security)) return;

		for (const requirement of security) {
			if (!isRecord(requirement)) continue;

			for (const name of Object.keys(requirement)) {
				usedNames.add(name);
			}
		}
	}

	collect(spec.security);

	forEachOperation(spec.paths ?? {}, ({ operation }) => {
		collect(operation.security);
	});

	return [...usedNames].map(
		(name) => `/components/securitySchemes/${escapePointerPart(name)}`,
	);
}

function buildTopLevelTags(
	source: OpenApiSpec,
	output: OpenApiSpec,
	mode: TagOutputMode,
): OpenApiSpec[] {
	if (mode === "none") return [];

	if (mode === "all") {
		return Array.isArray(source.tags) ? deepClone(source.tags) : [];
	}

	const used = new Set<string>();

	forEachOperation(output.paths ?? {}, ({ operation }) => {
		if (!Array.isArray(operation.tags)) return;

		for (const tag of operation.tags) {
			used.add(String(tag));
		}
	});

	const sourceTags = Array.isArray(source.tags) ? source.tags : [];
	const result: OpenApiSpec[] = [];

	for (const tag of sourceTags) {
		if (isRecord(tag) && used.has(String(tag.name))) {
			result.push(deepClone(tag));
		}
	}

	for (const tagName of used) {
		const exists = result.some((tag) => tag.name === tagName);

		if (!exists) {
			result.push({ name: tagName });
		}
	}

	return result;
}

function findBrokenLocalRefs(spec: OpenApiSpec): RefIssue[] {
	const refs = collectRefsWithLocations(spec);
	const issues: RefIssue[] = [];

	for (const item of refs) {
		if (!item.ref.startsWith("#/")) continue;

		const target = getByPointer(spec, normalizePointer(item.ref));

		if (target === undefined) {
			issues.push({
				ref: item.ref,
				location: item.location,
				message: `Broken local ref ${item.ref} at ${item.location}`,
			});
		}
	}

	return issues;
}

function collectRefsWithLocations(
	value: unknown,
	currentPointer = "",
): Array<{ ref: string; location: string }> {
	const refs: Array<{ ref: string; location: string }> = [];

	function walk(node: unknown, pointer: string): void {
		if (Array.isArray(node)) {
			node.forEach((item, index) => {
				walk(item, joinPointer(pointer, String(index)));
			});

			return;
		}

		if (!isRecord(node)) return;

		if (typeof node.$ref === "string") {
			refs.push({
				ref: node.$ref,
				location: joinPointer(pointer, "$ref"),
			});
		}

		for (const [key, child] of Object.entries(node)) {
			walk(child, joinPointer(pointer, key));
		}
	}

	walk(value, currentPointer);

	return refs;
}

function copyPathItemMetadata(pathItem: OpenApiSpec): OpenApiSpec {
	const result: OpenApiSpec = {};

	for (const [key, value] of Object.entries(pathItem)) {
		if (!isHttpMethod(key.toLowerCase())) {
			result[key] = deepClone(value);
		}
	}

	return result;
}

function pathItemHasOperations(pathItem: OpenApiSpec): boolean {
	return Object.keys(pathItem).some((key) => isHttpMethod(key.toLowerCase()));
}

function forEachOperation(
	paths: OpenApiSpec,
	callback: (ctx: {
		path: string;
		method: HttpMethod;
		operation: OpenApiSpec;
		pathItem: OpenApiSpec;
	}) => void,
): void {
	for (const [path, pathItem] of Object.entries(paths ?? {})) {
		if (!isRecord(pathItem)) continue;

		for (const [rawMethod, operation] of Object.entries(pathItem)) {
			const method = rawMethod.toLowerCase();

			if (!isHttpMethod(method)) continue;
			if (!isRecord(operation)) continue;

			callback({
				path,
				method,
				operation,
				pathItem,
			});
		}
	}
}

function operationInfo(
	path: string,
	method: string,
	operation: OpenApiSpec,
): OperationInfo {
	return {
		method: method.toUpperCase(),
		path,
		operationId: operation.operationId,
		tags: Array.isArray(operation.tags) ? operation.tags.map(String) : [],
		summary: operation.summary,
		description: operation.description,
	};
}

function applyExtensionRemoval(
	value: unknown,
	removeExtensions: boolean | string[],
): void {
	if (!removeExtensions) return;

	const removeAll = removeExtensions === true;
	const removeSet = Array.isArray(removeExtensions)
		? new Set(removeExtensions)
		: new Set<string>();

	function walk(node: unknown): void {
		if (Array.isArray(node)) {
			for (const item of node) walk(item);
			return;
		}

		if (!isRecord(node)) return;

		for (const key of Object.keys(node)) {
			const shouldRemove =
				key.startsWith("x-") && (removeAll || removeSet.has(key));

			if (shouldRemove) {
				delete node[key];
				continue;
			}

			walk(node[key]);
		}
	}

	walk(value);
}

function getByPointer(root: unknown, pointerOrRef: string): unknown {
	const pointer = normalizePointer(pointerOrRef);

	if (pointer === "") return root;
	if (!pointer.startsWith("/")) return undefined;

	const parts = splitPointer(pointer);
	let current: any = root;

	for (const part of parts) {
		if (current == null) return undefined;

		if (Array.isArray(current)) {
			const index = Number(part);

			if (!Number.isInteger(index) || index < 0 || index >= current.length) {
				return undefined;
			}

			current = current[index];
			continue;
		}

		if (!isRecord(current) || !(part in current)) {
			return undefined;
		}

		current = current[part];
	}

	return current;
}

function setByPointer(
	root: OpenApiSpec,
	pointerOrRef: string,
	value: unknown,
): void {
	const pointer = normalizePointer(pointerOrRef);

	if (pointer === "") {
		throw new Error("Setting the root pointer is not supported.");
	}

	const parts = splitPointer(pointer);
	let current: any = root;

	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];
		const nextPart = parts[i + 1];
		const shouldCreateArray = isArrayIndex(nextPart);

		if (Array.isArray(current)) {
			const index = Number(part);

			if (current[index] === undefined) {
				current[index] = shouldCreateArray ? [] : {};
			}

			current = current[index];
			continue;
		}

		if (!isRecord(current[part])) {
			current[part] = shouldCreateArray ? [] : {};
		}

		current = current[part];
	}

	const lastPart = parts[parts.length - 1];

	if (Array.isArray(current)) {
		current[Number(lastPart)] = value;
	} else {
		current[lastPart] = value;
	}
}

function deleteByPointer(root: OpenApiSpec, pointerOrRef: string): boolean {
	const pointer = normalizePointer(pointerOrRef);

	if (pointer === "") {
		return false;
	}

	const parts = splitPointer(pointer);
	let current: any = root;

	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];

		if (Array.isArray(current)) {
			const index = Number(part);
			current = current[index];
		} else if (isRecord(current)) {
			current = current[part];
		} else {
			return false;
		}

		if (current === undefined) {
			return false;
		}
	}

	const lastPart = parts[parts.length - 1];

	if (Array.isArray(current)) {
		const index = Number(lastPart);

		if (!Number.isInteger(index) || index < 0 || index >= current.length) {
			return false;
		}

		current.splice(index, 1);
		return true;
	}

	if (isRecord(current) && lastPart in current) {
		delete current[lastPart];
		return true;
	}

	return false;
}

function normalizePointer(pointerOrRef: string): string {
	if (pointerOrRef.startsWith("#/")) {
		return decodeURIComponent(pointerOrRef.slice(1));
	}

	if (pointerOrRef === "#") {
		return "";
	}

	return pointerOrRef;
}

function normalizePointers(pointers: string[]): string[] {
	return pointers.map(normalizePointer);
}

function pointerToRef(pointer: string): string {
	if (pointer === "") return "#";
	return `#${pointer}`;
}

function splitPointer(pointer: string): string[] {
	if (pointer === "") return [];

	if (!pointer.startsWith("/")) {
		throw new Error(`Invalid JSON Pointer: ${pointer}`);
	}

	return pointer.slice(1).split("/").map(unescapePointerPart);
}

function joinPointer(base: string, part: string): string {
	return `${base}/${escapePointerPart(part)}`;
}

function escapePointerPart(part: string): string {
	return part.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapePointerPart(part: string): string {
	return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function removeEmptyContainers(output: OpenApiSpec): void {
	if (isRecord(output.components)) {
		for (const [group, value] of Object.entries(output.components)) {
			if (isRecord(value) && Object.keys(value).length === 0) {
				delete output.components[group];
			}
		}

		if (Object.keys(output.components).length === 0) {
			delete output.components;
		}
	}

	if (isRecord(output.paths)) {
		for (const [path, pathItem] of Object.entries(output.paths)) {
			if (isRecord(pathItem) && !pathItemHasOperations(pathItem)) {
				delete output.paths[path];
			}
		}
	}
}

function countComponents(components: unknown): Record<string, number> {
	if (!isRecord(components)) return {};

	const result: Record<string, number> = {};

	for (const [group, value] of Object.entries(components)) {
		result[group] = isRecord(value) ? Object.keys(value).length : 0;
	}

	return result;
}

function mergeDeep(target: OpenApiSpec, source: OpenApiSpec): OpenApiSpec {
	for (const [key, value] of Object.entries(source)) {
		if (isRecord(value) && isRecord(target[key])) {
			mergeDeep(target[key], value);
		} else {
			target[key] = deepClone(value);
		}
	}

	return target;
}

function resolveOutputFormat(
	outputFormat: OutputFormat | undefined,
	inputFormat: InputFormat,
): "json" | "yaml" {
	if (!outputFormat || outputFormat === "same-as-input") {
		if (inputFormat === "yaml") return "yaml";
		return "json";
	}

	return outputFormat;
}

function isHttpMethod(value: string): value is HttpMethod {
	return HTTP_METHODS.has(value as HttpMethod);
}

function isRecord(value: unknown): value is OpenApiSpec {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isArrayIndex(value: string): boolean {
	return /^\d+$/.test(value);
}

function toRegex(value: string | RegExp): RegExp {
	return value instanceof RegExp ? value : new RegExp(value);
}

function deepClone<T>(value: T): T {
	if (value === undefined) return value;

	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}
