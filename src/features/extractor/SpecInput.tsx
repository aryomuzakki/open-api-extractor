import { useStore } from "@tanstack/react-store";
import {
	AlertTriangleIcon,
	ClipboardIcon,
	FileUpIcon,
	LinkIcon,
	Loader2Icon,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button, buttonVariants } from "#/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "@/lib/utils";
import { actions, extractorStore } from "./use-extractor-store";

export function SpecInput() {
	const [activeTab, setActiveTab] = useState<string>("paste");
	const [dragOver, setDragOver] = useState(false);
	const [fileName, setFileName] = useState<string>("");
	const [loading, setLoading] = useState(false);

	const rawInput = useStore(extractorStore, (state) => state.rawInput);
	const error = useStore(extractorStore, (state) => state.error);

	const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		actions.setInputText(e.target.value);
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
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	};

	const handleDragLeave = () => {
		setDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files?.[0];
		if (file) processFile(file);
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
					<AlertDescription className="text-xs break-all mt-1">
						{error}
					</AlertDescription>
				</Alert>
			)}

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3 mb-4">
					<TabsTrigger value="paste">
						<ClipboardIcon className="mr-2 h-4 w-4" /> Paste Text
					</TabsTrigger>
					<TabsTrigger value="file">
						<FileUpIcon className="mr-2 h-4 w-4" /> Upload File
					</TabsTrigger>
					<TabsTrigger value="url">
						<LinkIcon className="mr-2 h-4 w-4" /> From URL
					</TabsTrigger>
				</TabsList>

				<TabsContent value="paste" className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<div className="flex justify-between items-center">
							<span className="text-xs text-muted-foreground font-medium">
								Paste your OpenAPI spec (YAML or JSON) below:
							</span>
							<button
								type="button"
								onClick={handleSampleClick}
								className="text-xs text-primary font-medium hover:underline cursor-pointer"
							>
								Load Sample Spec
							</button>
						</div>
						<Textarea
							value={rawInput}
							onChange={handlePasteChange}
							placeholder='e.g., {"openapi": "3.0.0", "info": ...}'
							className="font-mono text-xs min-h-[300px] max-h-[50dvh] bg-background/50 border-input"
						/>
					</div>
					<Button
						onClick={handleLoad}
						disabled={loading || !rawInput.trim()}
						className="w-full cursor-pointer"
					>
						{loading ? (
							<>
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Parsing...
							</>
						) : (
							"Load Specification"
						)}
					</Button>
				</TabsContent>

				<TabsContent value="file" className="flex flex-col gap-4">
					<section
						aria-label="File upload dropzone"
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center transition-all ${
							dragOver
								? "border-primary bg-primary/5"
								: "border-input bg-background/30 hover:bg-background/50"
						}`}
					>
						<FileUpIcon className="h-10 w-10 text-muted-foreground mb-4" />
						<h3 className="font-semibold text-sm mb-1">
							Drag & Drop file here
						</h3>
						<p className="text-xs text-muted-foreground mb-4">
							JSON, YAML, or YML up to 10MB
						</p>
						<div className="relative">
							<input
								type="file"
								id="file-upload"
								onChange={handleFileChange}
								accept=".json,.yaml,.yml"
								className="sr-only"
							/>
							<label
								htmlFor="file-upload"
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"cursor-pointer",
								)}
							>
								Choose File
							</label>
						</div>
						{fileName && (
							<div className="mt-4 text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full">
								Selected: {fileName}
							</div>
						)}
					</section>
				</TabsContent>

				<TabsContent value="url" className="flex flex-col gap-4">
					<div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-background/20 text-center">
						<LinkIcon className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
						<h3 className="font-semibold text-sm mb-1">URL Import</h3>
						<p className="text-xs text-muted-foreground mb-4 max-w-xs">
							Load spec directly from a public URL. (e.g. Swagger / OpenAPI url)
						</p>
						<span className="px-3 py-1 text-[10px] font-bold tracking-wider text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40 rounded-full uppercase">
							Coming Soon
						</span>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
