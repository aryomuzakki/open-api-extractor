/**
 * Configuration options for the OpenAPI Extractor tool.
 */
export const EXTRACTOR_CONFIG = {
	/**
	 * Controls whether importing a spec (via File upload or URL fetch)
	 * automatically triggers step 2 parsing ("load spec") or requires
	 * the user to manually click "Load Specification".
	 *
	 * Set to `false` to require manual clicking of "Load Specification".
	 * Set to `true` to auto-advance to operation selection on import.
	 */
	AUTO_LOAD_SPEC_ON_IMPORT: false,

	/**
	 * Popular OpenAPI sample URLs for quick testing in the URL importer.
	 */
	SAMPLE_SPEC_URLS: [
		{
			label: "Swagger Petstore (v3 JSON)",
			url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.json",
		},
		{
			label: "Swagger Petstore (v3 YAML)",
			url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml",
		},
		{
			label: "Uspto API (v3 JSON)",
			url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/uspto.json",
		},
	],
} as const;
