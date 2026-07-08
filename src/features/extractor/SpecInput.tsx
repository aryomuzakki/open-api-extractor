"use client";

import Editor from "@monaco-editor/react";
import { useStore } from "@tanstack/react-store";
import {
	AlertTriangleIcon,
	FileUpIcon,
	LinkIcon,
	Loader2Icon,
	UploadCloudIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button, buttonVariants } from "#/components/ui/button";
import { useThemeObserver } from "#/hooks/use-theme-observer";
import { cn } from "@/lib/utils";
import { actions, extractorStore } from "./use-extractor-store";

function getLanguage(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return "json";
	}
	return "yaml";
}

export function SpecInput() {
	const [dragOver, setDragOver] = useState(false);
	const [fileName, setFileName] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const textareaRef = useRef<HTMLDivElement>(null);
	const theme = useThemeObserver();

	const rawInput = useStore(extractorStore, (state) => state.rawInput);
	const error = useStore(extractorStore, (state) => state.error);

	const handleEditorChange = (val: string | undefined) => {
		actions.setInputText(val || "");
		if (fileName) setFileName("");
	};

	const handleLoad = () => {
		setLoading(true);
		// Minimal timeout to let loader display
		setTimeout(() => {
			actions.loadSpec();
			setLoading(false);
		}, 100);
	};

	const processFile = (file: File) => {
		if (!file) return;
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			actions.setInputText(text);
			// Auto load after selection
			setTimeout(() => {
				actions.loadSpec();
			}, 50);
		};
		reader.readAsText(file);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) processFile(file);
		// Reset input so same file can be re-selected
		e.target.value = "";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		// Only clear if leaving the container entirely
		if (!textareaRef.current?.contains(e.relatedTarget as Node)) {
			setDragOver(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files?.[0];
		if (file) {
			processFile(file);
		} else {
			// Handle plain text drops
			const text = e.dataTransfer.getData("text/plain");
			if (text) actions.setInputText(text);
		}
	};

	const handleSampleClick = () => {
		const sampleSpec = {
			openapi: "3.0.0",
			info: {
				title: "Sample API",
				version: "1.0.0",
				description: "A sample API for testing OpenAPI Extractor",
			},
			paths: {
				"/users": {
					get: {
						summary: "List users",
						tags: ["Users"],
						responses: {
							"200": {
								description: "Successful response",
								content: {
									"application/json": {
										schema: {
											type: "array",
											items: {
												$ref: "#/components/schemas/User",
											},
										},
									},
								},
							},
						},
					},
					post: {
						summary: "Create a user",
						tags: ["Users"],
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/UserCreate",
									},
								},
							},
						},
						responses: {
							"201": {
								description: "Created",
							},
						},
					},
				},
				"/users/{id}": {
					get: {
						summary: "Get user by ID",
						tags: ["Users"],
						parameters: [
							{
								name: "id",
								in: "path",
								required: true,
								schema: {
									type: "string",
								},
							},
						],
						responses: {
							"200": {
								description: "Successful response",
							},
						},
					},
				},
				"/products": {
					get: {
						summary: "List products",
						tags: ["Products"],
						responses: {
							"200": {
								description: "Successful response",
							},
						},
					},
				},
			},
			components: {
				schemas: {
					User: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
						},
					},
					UserCreate: {
						type: "object",
						required: ["name"],
						properties: {
							name: { type: "string" },
						},
					},
				},
			},
		};
		actions.setInputText(JSON.stringify(sampleSpec, null, 2));
		setFileName("");
	};

	return (
		<div className="flex flex-col gap-6">
			{error && (
				<Alert
					variant="destructive"
					className="animate-in fade-in slide-in-from-top-2 duration-200"
				>
					<AlertTriangleIcon className="h-4 w-4" />
					<AlertTitle>Error Parsing Spec</AlertTitle>
					<AlertDescription className="mt-1 break-all text-xs">
						{error}
					</AlertDescription>
				</Alert>
			)}

			{/* Unified input area */}
			<div className="flex flex-col gap-3">
				{/* Header row */}
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">
						Paste your OpenAPI spec (YAML or JSON), or drop a file anywhere in
						the box:
					</span>
					<div className="flex items-center gap-3">
						{fileName && (
							<span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
								<FileUpIcon className="h-3 w-3" />
								{fileName}
							</span>
						)}
						<button
							type="button"
							onClick={handleSampleClick}
							className="cursor-pointer text-xs font-medium text-primary hover:underline"
						>
							Load Sample Spec
						</button>
					</div>
				</div>

				{/* Drop zone wrapper around textarea */}
				{/** biome-ignore lint/a11y/noStaticElementInteractions: <handle input> */}
				<div
					ref={textareaRef}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className="relative"
				>
					<div
						className={cn(
							"rounded-xl border bg-background/50 overflow-hidden transition-all duration-150",
							dragOver && "border-primary ring-2 ring-primary/20",
						)}
					>
						<Editor
							height="320px"
							language={getLanguage(rawInput)}
							theme={theme}
							value={rawInput}
							onChange={handleEditorChange}
							loading={
								<div className="flex h-[320px] w-full items-center justify-center gap-2 text-xs text-muted-foreground bg-background/50">
									<Loader2Icon className="h-4 w-4 animate-spin text-primary" />
									<span>Loading editor...</span>
								</div>
							}
							options={{
								minimap: { enabled: false },
								wordWrap: "on",
								lineNumbers: "on",
								scrollBeyondLastLine: false,
								automaticLayout: true,
								fontSize: 12,
								fontFamily: "var(--font-mono), monospace",
								padding: { top: 8, bottom: 8 },
								folding: true,
								glyphMargin: false,
								lineDecorationsWidth: 10,
								lineNumbersMinChars: 3,
								theme: theme === "vs-dark" ? "vs-dark" : "light",
							}}
						/>
					</div>

					{/* Drag overlay */}
					{dragOver && (
						<div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
							<UploadCloudIcon className="h-10 w-10 text-primary animate-bounce" />
							<p className="text-sm font-semibold text-primary">
								Drop your file to load it
							</p>
							<p className="text-xs text-muted-foreground">
								JSON, YAML, or YML supported
							</p>
						</div>
					)}
				</div>

				{/* Action row */}
				<div className="flex items-center gap-3">
					{/* File upload button */}
					<div className="relative shrink-0">
						<input
							type="file"
							id="spec-file-upload"
							onChange={handleFileChange}
							accept=".json,.yaml,.yml"
							className="sr-only"
						/>
						<label
							htmlFor="spec-file-upload"
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"cursor-pointer gap-2",
							)}
						>
							<FileUpIcon className="h-4 w-4" />
							Upload File
						</label>
					</div>

					{/* URL coming soon badge */}
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<LinkIcon className="h-3.5 w-3.5 opacity-50" />
						<span className="opacity-60">URL import</span>
						<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
							Soon
						</span>
					</div>

					{/* Load button */}
					<Button
						onClick={handleLoad}
						disabled={loading || !rawInput.trim()}
						className="ml-auto w-fit cursor-pointer"
					>
						{loading ? (
							<>
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Parsing...
							</>
						) : (
							"Load Specification"
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
