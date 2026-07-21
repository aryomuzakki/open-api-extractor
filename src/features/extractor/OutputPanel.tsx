import Editor from "@monaco-editor/react";
import { useStore } from "@tanstack/react-store";
import {
	AlertTriangleIcon,
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ListRestartIcon,
	Loader2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { useThemeObserver } from "#/hooks/use-theme-observer";
import type { OperationInfo, RefIssue } from "#/lib/open-api-extractor";
import { actions, extractorStore } from "./use-extractor-store";

export function OutputPanel() {
	const outputText = useStore(extractorStore, (state) => state.outputText);
	const outputFormat = useStore(extractorStore, (state) => state.outputFormat);
	const diagnostics = useStore(extractorStore, (state) => state.diagnostics);
	const parsedSpec = useStore(extractorStore, (state) => state.parsedSpec);

	const [copied, setCopied] = useState(false);
	const theme = useThemeObserver();

	// Handle format change and regenerate outputText
	const handleFormatChange = (format: "json" | "yaml") => {
		actions.setOutputFormat(format);
		// Re-extract to update output format
		actions.extract();
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(outputText);
			setCopied(true);
			toast.success("Copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy text.");
		}
	};

	const handleDownload = () => {
		const extension = outputFormat === "yaml" ? "yaml" : "json";
		const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");

		// Extract original title or use default
		const title = parsedSpec?.info?.title
			? parsedSpec.info.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
			: "extracted-spec";

		link.href = url;
		link.download = `${title}.openapi.${extension}`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		toast.success(`Downloaded ${title}.openapi.${extension}`);
	};

	const componentCounts = useMemo(() => {
		if (!diagnostics?.componentCounts) return [];
		return Object.entries(diagnostics.componentCounts).map(
			([group, count]) => ({
				group,
				count: count as number,
			}),
		);
	}, [diagnostics]);

	const warningsCount = diagnostics?.warnings?.length ?? 0;
	const brokenRefsCount = diagnostics?.brokenRefs?.length ?? 0;
	const unresolvedRefsCount = diagnostics?.unresolvedRefs?.length ?? 0;
	const totalWarningsCount =
		warningsCount + brokenRefsCount + unresolvedRefsCount;
	const hasWarnings = totalWarningsCount > 0;

	return (
		<div className="flex flex-col gap-6 animate-in fade-in duration-200">
			{/* Format Toggle & General Actions */}
			<div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b pb-4">
				<Tabs
					value={outputFormat}
					onValueChange={(val: string) =>
						handleFormatChange(val as "json" | "yaml")
					}
					className="w-full sm:w-auto"
				>
					<TabsList className="grid grid-cols-2 w-full sm:w-44">
						<TabsTrigger value="json">JSON</TabsTrigger>
						<TabsTrigger value="yaml">YAML</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopy}
						className="cursor-pointer"
					>
						{copied ? (
							<CheckIcon className="mr-2 h-4 w-4 text-emerald-500" />
						) : (
							<CopyIcon className="mr-2 h-4 w-4" />
						)}
						{copied ? "Copied" : "Copy"}
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={handleDownload}
						className="cursor-pointer"
					>
						<DownloadIcon className="mr-2 h-4 w-4" /> Download
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={actions.backToSelection}
						className="cursor-pointer"
					>
						<ListRestartIcon className="mr-2 h-4 w-4" /> Start Over
					</Button>
				</div>
			</div>

			{/* Compact Stats Card & Warnings Row */}
			<div className="flex flex-col gap-4">
				<Card className="bg-background/40 p-4">
					<div className="grid grid-cols-3 divide-x divide-border/50 text-center sm:text-left">
						<div className="flex flex-col gap-0.5 sm:pr-4">
							<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								Paths Selected
							</span>
							<span className="text-xl sm:text-2xl font-black text-primary">
								{diagnostics?.keptOperations?.length || 0}
							</span>
						</div>
						<div className="flex flex-col gap-0.5 px-2 sm:px-4">
							<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								Paths Removed
							</span>
							<span className="text-xl sm:text-2xl font-black text-muted-foreground">
								{diagnostics?.removedOperations?.length || 0}
							</span>
						</div>
						<div className="flex flex-col gap-0.5 pl-2 sm:pl-4">
							<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								Kept Components
							</span>
							<span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
								{diagnostics?.keptComponents?.length || 0}
							</span>
						</div>
					</div>
				</Card>

				{/* Warnings Section - only shown if warnings exist */}
				{hasWarnings && (
					<div className="flex flex-col gap-3">
						<h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
							<AlertTriangleIcon className="h-3.5 w-3.5" />
							Warnings & Issues ({totalWarningsCount})
						</h3>
						<div className="flex flex-col gap-2.5">
							{diagnostics?.warnings?.map((warn: string) => (
								<Alert
									key={warn}
									className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 py-2.5"
								>
									<AlertTriangleIcon className="h-4 w-4 text-amber-600" />
									<AlertTitle className="text-xs font-semibold">
										Warning
									</AlertTitle>
									<AlertDescription className="text-xs mt-0.5">
										{warn}
									</AlertDescription>
								</Alert>
							))}

							{diagnostics?.brokenRefs?.map((issue: RefIssue) => (
								<Alert
									key={`${issue.ref}-${issue.location}`}
									variant="destructive"
									className="py-2.5"
								>
									<AlertTriangleIcon className="h-4 w-4" />
									<AlertTitle className="text-xs font-semibold">
										Broken Local Reference
									</AlertTitle>
									<AlertDescription className="text-xs mt-0.5">
										Reference{" "}
										<code className="font-mono text-xs">{issue.ref}</code> is
										broken at location{" "}
										<code className="font-mono text-xs">{issue.location}</code>.
									</AlertDescription>
								</Alert>
							))}

							{diagnostics?.unresolvedRefs?.map((issue: RefIssue) => (
								<Alert
									key={`${issue.ref}-${issue.location}`}
									variant="destructive"
									className="py-2.5"
								>
									<AlertTriangleIcon className="h-4 w-4" />
									<AlertTitle className="text-xs font-semibold">
										Unresolved Component Reference
									</AlertTitle>
									<AlertDescription className="text-xs mt-0.5">
										Could not resolve component reference{" "}
										<code className="font-mono text-xs">{issue.ref}</code> at{" "}
										<code className="font-mono text-xs">{issue.location}</code>.
									</AlertDescription>
								</Alert>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Monaco Editor (Preview Output) */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
						Preview Output ({outputFormat.toUpperCase()})
					</h3>
				</div>
				<div className="relative rounded-xl border bg-slate-950 text-slate-100 overflow-hidden shadow-inner">
					<div className="absolute right-3 top-3 z-10 flex gap-2">
						<Button
							variant="ghost"
							size="xs"
							onClick={handleCopy}
							className="h-7 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
						>
							{copied ? (
								<CheckIcon className="h-3 w-3 text-emerald-400" />
							) : (
								<CopyIcon className="h-3 w-3" />
							)}
						</Button>
					</div>
					<Editor
						height="400px"
						language={outputFormat}
						theme={theme}
						value={outputText}
						loading={
							<div className="flex h-[400px] items-center justify-center gap-2 text-xs text-muted-foreground bg-slate-950">
								<Loader2Icon className="h-4 w-4 animate-spin text-primary" />
								<span>Loading editor...</span>
							</div>
						}
						options={{
							readOnly: true,
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
			</div>

			{/* Additional Details: Components Breakdown & Extracted Endpoints */}
			{(componentCounts.length > 0 ||
				(diagnostics?.keptOperations?.length ?? 0) > 0) && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{componentCounts.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
								Components Breakdown
							</h3>
							<div className="grid grid-cols-2 gap-2.5">
								{componentCounts.map(({ group, count }) => (
									<div
										key={group}
										className="flex items-center justify-between border rounded-lg p-2.5 bg-background/20"
									>
										<span className="text-xs font-semibold font-mono">
											{group}
										</span>
										<span className="text-xs font-extrabold text-foreground px-2 py-0.5 bg-muted rounded-full">
											{count}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{(diagnostics?.keptOperations?.length ?? 0) > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
								Extracted Endpoints
							</h3>
							<div className="border rounded-xl bg-background/30 divide-y max-h-[220px] overflow-y-auto">
								{diagnostics?.keptOperations?.map((op: OperationInfo) => (
									<div
										key={`${op.method}-${op.path}`}
										className="flex items-center gap-3 px-3 py-2 text-xs"
									>
										<span className="font-extrabold text-primary text-[10px] tracking-wider uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20 min-w-[50px] text-center">
											{op.method}
										</span>
										<span className="font-mono truncate text-[11px]">
											{op.path}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
