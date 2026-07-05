import { useStore } from "@tanstack/react-store";
import {
	AlertTriangleIcon,
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ListRestartIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type { OperationInfo, RefIssue } from "#/lib/open-api-extractor";
import { actions, extractorStore } from "./use-extractor-store";

export function OutputPanel() {
	const outputText = useStore(extractorStore, (state) => state.outputText);
	const outputFormat = useStore(extractorStore, (state) => state.outputFormat);
	const diagnostics = useStore(extractorStore, (state) => state.diagnostics);
	const parsedSpec = useStore(extractorStore, (state) => state.parsedSpec);

	const [activeSubTab, setActiveSubTab] = useState<string>("preview");
	const [copied, setCopied] = useState(false);

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

	return (
		<div className="flex flex-col gap-6 animate-in fade-in duration-200">
			{/* Format Tabs & General Actions */}
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
						onClick={actions.reset}
						className="cursor-pointer"
					>
						<ListRestartIcon className="mr-2 h-4 w-4" /> Start Over
					</Button>
				</div>
			</div>

			{/* Sub Tabs: Preview vs Diagnostics */}
			<Tabs
				value={activeSubTab}
				onValueChange={setActiveSubTab}
				className="w-full"
			>
				<TabsList className="grid grid-cols-3 mb-4 w-full md:w-96">
					<TabsTrigger value="preview">Preview Output</TabsTrigger>
					<TabsTrigger value="details">Details & Stats</TabsTrigger>
					<TabsTrigger value="warnings">
						Warnings
						{(diagnostics?.warnings?.length ?? 0) > 0 && (
							<span className="ml-2 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
								{diagnostics?.warnings?.length}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="preview" className="mt-0">
					<div className="relative rounded-xl border bg-slate-950 text-slate-100 overflow-hidden shadow-inner">
						<div className="absolute right-4 top-4 z-10 flex gap-2">
							<Button
								variant="ghost"
								size="xs"
								onClick={handleCopy}
								className="h-7 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
							>
								{copied ? (
									<CheckIcon className="h-3 w-3 text-emerald-400" />
								) : (
									<CopyIcon className="h-3 w-3" />
								)}
							</Button>
						</div>
						<pre className="p-5 font-mono text-xs max-h-[480px] overflow-auto select-text scrollbar-thin scrollbar-thumb-slate-800 whitespace-pre-wrap break-all leading-relaxed">
							{outputText}
						</pre>
					</div>
				</TabsContent>

				<TabsContent value="details" className="mt-0 flex flex-col gap-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<Card className="bg-background/40">
							<div className="p-4 flex flex-col gap-1">
								<span className="text-xs text-muted-foreground font-semibold">
									Paths Selected
								</span>
								<span className="text-2xl font-black text-primary">
									{diagnostics?.keptOperations?.length || 0}
								</span>
							</div>
						</Card>
						<Card className="bg-background/40">
							<div className="p-4 flex flex-col gap-1">
								<span className="text-xs text-muted-foreground font-semibold">
									Paths Removed
								</span>
								<span className="text-2xl font-black text-muted-foreground">
									{diagnostics?.removedOperations?.length || 0}
								</span>
							</div>
						</Card>
						<Card className="bg-background/40">
							<div className="p-4 flex flex-col gap-1">
								<span className="text-xs text-muted-foreground font-semibold">
									Kept Components
								</span>
								<span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
									{diagnostics?.keptComponents?.length || 0}
								</span>
							</div>
						</Card>
					</div>

					{componentCounts.length > 0 && (
						<div className="mt-2 flex flex-col gap-2">
							<h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
								Components Breakdown
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
						<div className="mt-2 flex flex-col gap-2">
							<h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
								Extracted Endpoints
							</h3>
							<div className="border rounded-xl bg-background/30 divide-y max-h-[250px] overflow-y-auto">
								{diagnostics?.keptOperations?.map((op: OperationInfo) => (
									<div
										key={`${op.method}-${op.path}`}
										className="flex items-center gap-3 px-4 py-2 text-xs"
									>
										<span className="font-extrabold text-primary text-[10px] tracking-wider uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20 min-w-[55px] text-center">
											{op.method}
										</span>
										<span className="font-mono truncate">{op.path}</span>
										{op.summary && (
											<span className="text-muted-foreground truncate hidden md:inline ml-auto max-w-[40%]">
												— {op.summary}
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</TabsContent>

				<TabsContent value="warnings" className="mt-0 flex flex-col gap-4">
					{diagnostics?.warnings?.length === 0 &&
					diagnostics?.brokenRefs?.length === 0 &&
					diagnostics?.unresolvedRefs?.length === 0 ? (
						<div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-emerald-500/5 text-center text-emerald-600 dark:text-emerald-400">
							<CheckIcon className="h-8 w-8 mb-2" />
							<h3 className="font-semibold text-sm">
								No warnings or broken references found!
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								Your extracted specification is clean and resolve-valid.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							{diagnostics?.warnings?.map((warn: string) => (
								<Alert
									key={warn}
									className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
								>
									<AlertTriangleIcon className="h-4 w-4 text-amber-600" />
									<AlertTitle>Warning</AlertTitle>
									<AlertDescription className="text-xs mt-1">
										{warn}
									</AlertDescription>
								</Alert>
							))}

							{diagnostics?.brokenRefs?.map((issue: RefIssue) => (
								<Alert
									key={`${issue.ref}-${issue.location}`}
									variant="destructive"
								>
									<AlertTriangleIcon className="h-4 w-4" />
									<AlertTitle>Broken Local Reference</AlertTitle>
									<AlertDescription className="text-xs mt-1">
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
								>
									<AlertTriangleIcon className="h-4 w-4" />
									<AlertTitle>Unresolved Component Reference</AlertTitle>
									<AlertDescription className="text-xs mt-1">
										Could not resolve component reference{" "}
										<code className="font-mono text-xs">{issue.ref}</code> at{" "}
										<code className="font-mono text-xs">{issue.location}</code>.
									</AlertDescription>
								</Alert>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
