import { describe, expect, it } from "vitest";
import { extractOpenApi } from "../open-api-extractor";

describe("extractOpenApi", () => {
	it("extracts specific path correctly", () => {
		const spec = {
			openapi: "3.0.0",
			info: { title: "Test API", version: "1.0.0" },
			paths: {
				"/users": {
					get: {
						summary: "Get users",
						responses: { "200": { description: "OK" } },
					},
				},
				"/posts": {
					get: {
						summary: "Get posts",
						responses: { "200": { description: "OK" } },
					},
				},
			},
		};

		const result = extractOpenApi(spec, {
			keep: [{ path: "/users" }],
		});

		expect(result.spec.paths).toHaveProperty("/users");
		expect(result.spec.paths).not.toHaveProperty("/posts");
	});
});
