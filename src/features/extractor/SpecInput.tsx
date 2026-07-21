"use client";

import Editor from "@monaco-editor/react";
import { useStore } from "@tanstack/react-store";
import {
	AlertCircleIcon,
	AlertTriangleIcon,
	ArrowRightLeftIcon,
	FileUpIcon,
	GlobeIcon,
	KeyIcon,
	LinkIcon,
	Loader2Icon,
	LockIcon,
	ShieldIcon,
	SparklesIcon,
	UploadCloudIcon,
	UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { stringify as stringifyYaml } from "yaml";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button, buttonVariants } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { useThemeObserver } from "#/hooks/use-theme-observer";
import { parseOpenApi } from "#/lib/open-api-extractor";
import { cn } from "@/lib/utils";
import { EXTRACTOR_CONFIG } from "./config";
import { actions, extractorStore } from "./use-extractor-store";

type AuthType = "none" | "bearer" | "basic" | "custom";

const AUTH_STORAGE_KEY = "openapi-extractor-url-auth";

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

	// URL Importer State
	const [dialogOpen, setDialogOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [fetchingUrl, setFetchingUrl] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);

	// Authentication State
	const [authType, setAuthType] = useState<AuthType>("none");
	const [bearerToken, setBearerToken] = useState("");
	const [basicUser, setBasicUser] = useState("");
	const [basicPass, setBasicPass] = useState("");
	const [customHeaderName, setCustomHeaderName] = useState("");
	const [customHeaderValue, setCustomHeaderValue] = useState("");
	const [showAuthOptions, setShowAuthOptions] = useState(false);
	const [saveAuthConfig, setSaveAuthConfig] = useState(false);

	const textareaRef = useRef<HTMLDivElement>(null);
	const theme = useThemeObserver();

	const rawInput = useStore(extractorStore, (state) => state.rawInput);
	const error = useStore(extractorStore, (state) => state.error);

	// Restore saved auth config from localStorage on initial render
	useEffect(() => {
		try {
			const saved = localStorage.getItem(AUTH_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed && typeof parsed === "object" && parsed.saveAuthConfig) {
					setSaveAuthConfig(true);
					if (parsed.authType) setAuthType(parsed.authType);
					if (parsed.bearerToken) setBearerToken(parsed.bearerToken);
					if (parsed.basicUser) setBasicUser(parsed.basicUser);
					if (parsed.basicPass) setBasicPass(parsed.basicPass);
					if (parsed.customHeaderName)
						setCustomHeaderName(parsed.customHeaderName);
					if (parsed.customHeaderValue)
						setCustomHeaderValue(parsed.customHeaderValue);
					if (parsed.authType !== "none") setShowAuthOptions(true);
				}
			}
		} catch {
			// ignore
		}
	}, []);

	// Save or clear auth credentials in localStorage based on preference
	const persistAuth = (
		enabled: boolean,
		type = authType,
		token = bearerToken,
		bUser = basicUser,
		bPass = basicPass,
		hName = customHeaderName,
		hVal = customHeaderValue,
	) => {
		if (enabled) {
			try {
				localStorage.setItem(
					AUTH_STORAGE_KEY,
					JSON.stringify({
						saveAuthConfig: true,
						authType: type,
						bearerToken: token,
						basicUser: bUser,
						basicPass: bPass,
						customHeaderName: hName,
						customHeaderValue: hVal,
					}),
				);
			} catch {
				// ignore
			}
		} else {
			try {
				localStorage.removeItem(AUTH_STORAGE_KEY);
			} catch {
				// ignore
			}
		}
	};

	const handleAuthFieldChange = (
		updates: {
			type?: AuthType;
			token?: string;
			bUser?: string;
			bPass?: string;
			hName?: string;
			hVal?: string;
			enabled?: boolean;
		},
	) => {
		const newType = updates.type ?? authType;
		const newToken = updates.token ?? bearerToken;
		const newBUser = updates.bUser ?? basicUser;
		const newBPass = updates.bPass ?? basicPass;
		const newHName = updates.hName ?? customHeaderName;
		const newHVal = updates.hVal ?? customHeaderValue;
		const newEnabled = updates.enabled ?? saveAuthConfig;

		if (updates.type !== undefined) setAuthType(updates.type);
		if (updates.token !== undefined) setBearerToken(updates.token);
		if (updates.bUser !== undefined) setBasicUser(updates.bUser);
		if (updates.bPass !== undefined) setBasicPass(updates.bPass);
		if (updates.hName !== undefined) setCustomHeaderName(updates.hName);
		if (updates.hVal !== undefined) setCustomHeaderValue(updates.hVal);
		if (updates.enabled !== undefined) setSaveAuthConfig(updates.enabled);

		persistAuth(
			newEnabled,
			newType,
			newToken,
			newBUser,
			newBPass,
			newHName,
			newHVal,
		);
	};

	// Parse current rawInput in real-time to check valid JSON/YAML for format switching
	const parsedStatus = useMemo(() => {
		if (!rawInput.trim()) return null;
		try {
			const { spec, inputFormat } = parseOpenApi(rawInput);
			return { spec, inputFormat };
		} catch {
			return null;
		}
	}, [rawInput]);

	const handleSwitchFormat = () => {
		if (!parsedStatus) return;
		try {
			if (parsedStatus.inputFormat === "json") {
				const yamlText = stringifyYaml(parsedStatus.spec);
				actions.setInputText(yamlText);
			} else {
				const jsonText = JSON.stringify(parsedStatus.spec, null, 2);
				actions.setInputText(jsonText);
			}
		} catch {
			// ignore
		}
	};

	const handleEditorChange = (val: string | undefined) => {
		actions.setInputText(val || "");
		if (fileName) setFileName("");
	};

	const handleLoad = () => {
		setLoading(true);
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
			const text = (e.target?.result as string) || "";
			actions.setInputText(text);

			if (EXTRACTOR_CONFIG.AUTO_LOAD_SPEC_ON_IMPORT) {
				setTimeout(() => {
					actions.loadSpec();
				}, 50);
			}
		};
		reader.readAsText(file);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) processFile(file);
		e.target.value = "";
	};

	const handleFetchUrl = async (targetUrl?: string) => {
		const urlToFetch = (targetUrl || urlInput).trim();
		if (!urlToFetch) return;

		setFetchingUrl(true);
		setUrlError(null);

		const headers: Record<string, string> = {};

		if (authType === "bearer" && bearerToken.trim()) {
			headers.Authorization = `Bearer ${bearerToken.trim()}`;
		} else if (authType === "basic" && (basicUser || basicPass)) {
			const credentials = btoa(`${basicUser}:${basicPass}`);
			headers.Authorization = `Basic ${credentials}`;
		} else if (
			authType === "custom" &&
			customHeaderName.trim() &&
			customHeaderValue.trim()
		) {
			headers[customHeaderName.trim()] = customHeaderValue.trim();
		}

		try {
			const res = await fetch(urlToFetch, { headers });
			if (!res.ok) {
				throw new Error(
					`Failed to fetch URL (HTTP ${res.status}: ${res.statusText})`,
				);
			}
			const text = await res.text();
			if (!text.trim()) {
				throw new Error("The fetched specification file content is empty.");
			}

			actions.setInputText(text);
			const displayName = urlToFetch.split("/").pop() || "URL Source";
			setFileName(`URL: ${displayName}`);
			setDialogOpen(false);
			setUrlInput("");

			if (EXTRACTOR_CONFIG.AUTO_LOAD_SPEC_ON_IMPORT) {
				setTimeout(() => {
					actions.loadSpec();
				}, 50);
			}
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to fetch OpenAPI document. Please check the URL, credentials, and CORS headers.";
			setUrlError(message);
		} finally {
			setFetchingUrl(false);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
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
			const text = e.dataTransfer.getData("text/plain");
			if (text) {
				actions.setInputText(text);
				if (EXTRACTOR_CONFIG.AUTO_LOAD_SPEC_ON_IMPORT) {
					setTimeout(() => {
						actions.loadSpec();
					}, 50);
				}
			}
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

		if (EXTRACTOR_CONFIG.AUTO_LOAD_SPEC_ON_IMPORT) {
			setTimeout(() => {
				actions.loadSpec();
			}, 50);
		}
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
				<div className="flex items-center justify-between gap-2 flex-wrap">
					<span className="text-xs font-medium text-muted-foreground">
						Paste your OpenAPI spec (YAML or JSON), or drop a file anywhere in
						the box:
					</span>
					<div className="flex items-center gap-3 flex-wrap">
						{/* Format switch button (visible when current text is parsable) */}
						{parsedStatus && (
							<button
								type="button"
								onClick={handleSwitchFormat}
								className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/50 transition-all cursor-pointer shadow-2xs"
								title={`Convert specification format to ${
									parsedStatus.inputFormat === "json" ? "YAML" : "JSON"
								}`}
							>
								<ArrowRightLeftIcon className="h-3 w-3 text-primary" />
								<span>
									Switch to {parsedStatus.inputFormat === "json" ? "YAML" : "JSON"}
								</span>
								<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-muted-foreground">
									{parsedStatus.inputFormat}
								</span>
							</button>
						)}

						{fileName && (
							<span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
								{fileName.startsWith("URL:") ? (
									<GlobeIcon className="h-3 w-3" />
								) : (
									<FileUpIcon className="h-3 w-3" />
								)}
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

				{/* Drop zone wrapper around editor */}
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
				<div className="flex flex-wrap items-center gap-3 pt-1">
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
							<FileUpIcon className="h-4 w-4 text-muted-foreground" />
							Upload File
						</label>
					</div>

					{/* URL Import Dialog */}
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"cursor-pointer gap-2",
							)}
						>
							<GlobeIcon className="h-4 w-4 text-muted-foreground" />
							Import from URL
						</DialogTrigger>
						<DialogContent className="sm:max-w-lg">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<GlobeIcon className="h-5 w-5 text-primary" />
									Import OpenAPI from URL
								</DialogTitle>
								<DialogDescription>
									Enter the URL of a public or protected OpenAPI specification document.
								</DialogDescription>
							</DialogHeader>

							<div className="flex flex-col gap-4 py-2">
								{urlError && (
									<Alert variant="destructive">
										<AlertCircleIcon className="h-4 w-4" />
										<AlertTitle>Fetch Error</AlertTitle>
										<AlertDescription className="text-xs">
											{urlError}
										</AlertDescription>
									</Alert>
								)}

								<form
									onSubmit={(e) => {
										e.preventDefault();
										handleFetchUrl();
									}}
									className="flex flex-col gap-3"
								>
									{/* URL Input field + submit */}
									<div className="flex gap-2">
										<div className="relative flex-1">
											<LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												type="url"
												placeholder="https://api.example.com/openapi.json"
												value={urlInput}
												onChange={(e) => setUrlInput(e.target.value)}
												className="pl-9"
												disabled={fetchingUrl}
											/>
										</div>
										<Button
											type="submit"
											size="sm"
											disabled={fetchingUrl || !urlInput.trim()}
											className="cursor-pointer shrink-0"
										>
											{fetchingUrl ? (
												<Loader2Icon className="h-4 w-4 animate-spin" />
											) : (
												"Fetch"
											)}
										</Button>
									</div>

									{/* Auth Toggle Header */}
									<div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
										<button
											type="button"
											onClick={() => setShowAuthOptions((prev) => !prev)}
											className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
										>
											<ShieldIcon className="h-3.5 w-3.5 text-primary" />
											<span>Authentication</span>
											{authType !== "none" && (
												<span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary capitalize">
													{authType}
												</span>
											)}
										</button>
										<button
											type="button"
											onClick={() => setShowAuthOptions((prev) => !prev)}
											className="text-[11px] text-muted-foreground hover:underline cursor-pointer"
										>
											{showAuthOptions ? "Hide options" : "Configure auth"}
										</button>
									</div>

									{/* Auth Settings Panel */}
									{showAuthOptions && (
										<div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs transition-all">
											<div className="flex items-center justify-between gap-3">
												<label
													htmlFor="auth-type-select"
													className="font-medium text-muted-foreground shrink-0"
												>
													Auth Type:
												</label>
												<NativeSelect
													id="auth-type-select"
													value={authType}
													onChange={(e) =>
														handleAuthFieldChange({
															type: e.target.value as AuthType,
														})
													}
													className="w-48"
												>
													<NativeSelectOption value="none">
														None (Public)
													</NativeSelectOption>
													<NativeSelectOption value="bearer">
														Bearer Token
													</NativeSelectOption>
													<NativeSelectOption value="basic">
														Basic Authentication
													</NativeSelectOption>
													<NativeSelectOption value="custom">
														Custom Header / API Key
													</NativeSelectOption>
												</NativeSelect>
											</div>

											{/* Bearer Token Input */}
											{authType === "bearer" && (
												<div className="flex flex-col gap-1.5 pt-1">
													<label
														htmlFor="bearer-token"
														className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"
													>
														<KeyIcon className="h-3 w-3" /> Token Secret
													</label>
													<Input
														id="bearer-token"
														type="password"
														placeholder="Bearer token (e.g. eyJhbGci...)"
														value={bearerToken}
														onChange={(e) =>
															handleAuthFieldChange({ token: e.target.value })
														}
														disabled={fetchingUrl}
													/>
												</div>
											)}

											{/* Basic Auth Inputs */}
											{authType === "basic" && (
												<div className="grid grid-cols-2 gap-2 pt-1">
													<div className="flex flex-col gap-1.5">
														<label
															htmlFor="basic-username"
															className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"
														>
															<UserIcon className="h-3 w-3" /> Username
														</label>
														<Input
															id="basic-username"
															type="text"
															placeholder="Username"
															value={basicUser}
															onChange={(e) =>
																handleAuthFieldChange({ bUser: e.target.value })
															}
															disabled={fetchingUrl}
														/>
													</div>
													<div className="flex flex-col gap-1.5">
														<label
															htmlFor="basic-password"
															className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"
														>
															<LockIcon className="h-3 w-3" /> Password
														</label>
														<Input
															id="basic-password"
															type="password"
															placeholder="Password"
															value={basicPass}
															onChange={(e) =>
																handleAuthFieldChange({ bPass: e.target.value })
															}
															disabled={fetchingUrl}
														/>
													</div>
												</div>
											)}

											{/* Custom Header / API Key Inputs */}
											{authType === "custom" && (
												<div className="grid grid-cols-2 gap-2 pt-1">
													<div className="flex flex-col gap-1.5">
														<label
															htmlFor="custom-header-name"
															className="text-[11px] font-medium text-muted-foreground"
														>
															Header Name
														</label>
														<Input
															id="custom-header-name"
															type="text"
															placeholder="e.g. X-API-Key"
															value={customHeaderName}
															onChange={(e) =>
																handleAuthFieldChange({ hName: e.target.value })
															}
															disabled={fetchingUrl}
														/>
													</div>
													<div className="flex flex-col gap-1.5">
														<label
															htmlFor="custom-header-value"
															className="text-[11px] font-medium text-muted-foreground"
														>
															Header Value
														</label>
														<Input
															id="custom-header-value"
															type="password"
															placeholder="Key value"
															value={customHeaderValue}
															onChange={(e) =>
																handleAuthFieldChange({ hVal: e.target.value })
															}
															disabled={fetchingUrl}
														/>
													</div>
												</div>
											)}

											{/* Save Auth in LocalStorage Option */}
											<div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-1">
												<Checkbox
													id="remember-auth-config"
													checked={saveAuthConfig}
													onCheckedChange={(checked) =>
														handleAuthFieldChange({ enabled: Boolean(checked) })
													}
												/>
												<label
													htmlFor="remember-auth-config"
													className="text-[11px] text-muted-foreground cursor-pointer select-none"
												>
													Save auth configuration in local storage
												</label>
											</div>
										</div>
									)}
								</form>

								{/* Preset sample spec URLs */}
								<div className="flex flex-col gap-1.5 pt-1">
									<span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
										<SparklesIcon className="h-3 w-3 text-primary" /> Preset Sample Specs:
									</span>
									<div className="flex flex-wrap gap-1.5">
										{EXTRACTOR_CONFIG.SAMPLE_SPEC_URLS.map((sample) => (
											<Button
												key={sample.url}
												variant="secondary"
												size="xs"
												disabled={fetchingUrl}
												onClick={() => {
													setUrlInput(sample.url);
													handleFetchUrl(sample.url);
												}}
												className="cursor-pointer text-[11px] h-7 px-2.5"
											>
												{sample.label}
											</Button>
										))}
									</div>
								</div>
							</div>
						</DialogContent>
					</Dialog>

					{/* Load button */}
					<Button
						onClick={handleLoad}
						disabled={loading || !rawInput.trim()}
						className="ml-auto w-fit cursor-pointer gap-2"
					>
						{loading ? (
							<>
								<Loader2Icon className="h-4 w-4 animate-spin" /> Parsing...
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
