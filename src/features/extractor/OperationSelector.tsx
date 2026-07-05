import { useStore } from "@tanstack/react-store";
import {
	CheckSquareIcon,
	SearchIcon,
	Settings2Icon,
	SparklesIcon,
	SquareIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import type { BrokenRefMode, TagOutputMode } from "#/lib/open-api-extractor";
import { actions, extractorStore } from "./use-extractor-store";

const METHOD_COLORS: Record<string, string> = {
	GET: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
	POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
	PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
	DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
	PATCH:
		"bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
	OPTIONS:
		"bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
	HEAD: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

export function OperationSelector() {
	const operations = useStore(extractorStore, (state) => state.operations);
	const selectedKeys = useStore(extractorStore, (state) => state.selectedKeys);

	// Extraction config option states
	const keepReferencedComponents = useStore(
		extractorStore,
		(state) => state.keepReferencedComponents,
	);
	const removeUnusedComponents = useStore(
		extractorStore,
		(state) => state.removeUnusedComponents,
	);
	const tagOutputMode = useStore(
		extractorStore,
		(state) => state.tagOutputMode,
	);
	const onBrokenRef = useStore(extractorStore, (state) => state.onBrokenRef);
	const removeExtensions = useStore(
		extractorStore,
		(state) => state.removeExtensions,
	);

	const [searchQuery, setSearchQuery] = useState("");

	// Filtered operations based on search query
	const filteredOperations = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return operations;

		return operations.filter((op) => {
			return (
				op.path.toLowerCase().includes(query) ||
				op.method.toLowerCase().includes(query) ||
				op.summary?.toLowerCase().includes(query) ||
				op.description?.toLowerCase().includes(query) ||
				op.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		});
	}, [operations, searchQuery]);

	// Group operations by tag
	const groupedOperations = useMemo(() => {
		const groups: Record<string, typeof filteredOperations> = {};

		for (const op of filteredOperations) {
			const tags = op.tags.length > 0 ? op.tags : ["Default (No Tag)"];
			for (const tag of tags) {
				if (!groups[tag]) {
					groups[tag] = [];
				}
				groups[tag].push(op);
			}
		}

		return groups;
	}, [filteredOperations]);

	// Sorted list of tag groups
	const sortedTags = useMemo(() => {
		return Object.keys(groupedOperations).sort((a, b) => {
			if (a === "Default (No Tag)") return 1;
			if (b === "Default (No Tag)") return -1;
			return a.localeCompare(b);
		});
	}, [groupedOperations]);

	// Check if all operations in a tag are selected
	const getTagSelectionState = (tag: string) => {
		const opsInTag = operations.filter((op) => {
			const tags = op.tags.length > 0 ? op.tags : ["Default (No Tag)"];
			return tags.includes(tag);
		});

		if (opsInTag.length === 0) return "none";

		const selectedInTagCount = opsInTag.filter((op) => {
			const key = `${op.method.toUpperCase()} ${op.path}`;
			return selectedKeys.includes(key);
		}).length;

		if (selectedInTagCount === opsInTag.length) return "all";
		if (selectedInTagCount > 0) return "some";
		return "none";
	};

	const handleTagGroupToggle = (tag: string) => {
		const state = getTagSelectionState(tag);
		if (state === "all") {
			actions.selectByTag(tag, false);
		} else {
			actions.selectByTag(tag, true);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Filters and Selection tools */}
			<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
				<div className="relative flex-1">
					<SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-75" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Filter by path, method, summary, description or tag..."
						className="pl-9 bg-background/50 border-input w-full"
					/>
				</div>
				<div className="flex gap-2 shrink-0">
					<Button
						variant="outline"
						size="sm"
						onClick={actions.selectAll}
						className="flex-1 sm:flex-initial cursor-pointer"
					>
						<CheckSquareIcon className="mr-2 h-4 w-4" /> Select All
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={actions.deselectAll}
						className="flex-1 sm:flex-initial cursor-pointer"
					>
						<SquareIcon className="mr-2 h-4 w-4" /> Deselect All
					</Button>
				</div>
			</div>

			{/* Configuration Settings Accordion */}
			<Accordion className="w-full">
				<AccordionItem
					value="options"
					className="border rounded-xl bg-background/30 px-4"
				>
					<AccordionTrigger className="hover:no-underline py-3">
						<span className="flex items-center gap-2 text-sm font-semibold">
							<Settings2Icon className="h-4 w-4 text-primary" /> Extraction
							Options & Configuration
						</span>
					</AccordionTrigger>
					<AccordionContent className="pt-2 pb-4 flex flex-col gap-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="flex flex-col gap-4">
								<div className="flex items-center justify-between rounded-lg border p-3 bg-background/30">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Keep Referenced Components
										</Label>
										<p className="text-xs text-muted-foreground">
											Automatically pull components (schemas, etc.) referenced
											by selected paths.
										</p>
									</div>
									<Switch
										checked={keepReferencedComponents}
										onCheckedChange={(checked) =>
											actions.setOption("keepReferencedComponents", checked)
										}
									/>
								</div>

								<div className="flex items-center justify-between rounded-lg border p-3 bg-background/30">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Remove Unused Components
										</Label>
										<p className="text-xs text-muted-foreground">
											Prune components that are not reachable from selected
											endpoints.
										</p>
									</div>
									<Switch
										checked={removeUnusedComponents}
										onCheckedChange={(checked) =>
											actions.setOption("removeUnusedComponents", checked)
										}
									/>
								</div>
							</div>

							<div className="flex flex-col gap-4">
								<div className="flex items-center justify-between rounded-lg border p-3 bg-background/30">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Remove Extension Fields
										</Label>
										<p className="text-xs text-muted-foreground">
											Strip all `x-*` custom extension fields from final output.
										</p>
									</div>
									<Switch
										checked={removeExtensions}
										onCheckedChange={(checked) =>
											actions.setOption("removeExtensions", checked)
										}
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div className="flex flex-col gap-1.5">
										<Label className="text-xs font-semibold">
											Tag Output Mode
										</Label>
										<Select
											value={tagOutputMode}
											onValueChange={(val: string | null) => {
												if (val)
													actions.setOption(
														"tagOutputMode",
														val as TagOutputMode,
													);
											}}
										>
											<SelectTrigger className="bg-background/40">
												<SelectValue placeholder="Select mode" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="used">Used Tags Only</SelectItem>
												<SelectItem value="all">Keep All Original</SelectItem>
												<SelectItem value="none">Remove All Tags</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="flex flex-col gap-1.5">
										<Label className="text-xs font-semibold">
											On Broken Reference
										</Label>
										<Select
											value={onBrokenRef}
											onValueChange={(val: string | null) => {
												if (val)
													actions.setOption(
														"onBrokenRef",
														val as BrokenRefMode,
													);
											}}
										>
											<SelectTrigger className="bg-background/40">
												<SelectValue placeholder="Select action" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="warn">
													Warn (Output anyway)
												</SelectItem>
												<SelectItem value="error">Throw Error</SelectItem>
												<SelectItem value="ignore">Ignore silently</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			{/* Operations List */}
			<div className="grid gap-4 max-h-[60dvh] overflow-y-auto pr-1">
				{sortedTags.length === 0 ? (
					<div className="text-center py-10 border rounded-xl bg-background/20 text-muted-foreground">
						No endpoints match your filter.
					</div>
				) : (
					sortedTags.map((tag) => {
						const tagOps = groupedOperations[tag];
						const selectionState = getTagSelectionState(tag);

						return (
							<Card key={tag} className="border bg-background/40">
								<div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
									<div className="flex items-center gap-3">
										<Checkbox
											checked={
												(selectionState === "all"
													? true
													: selectionState === "some"
														? "mixed"
														: false) as unknown as boolean
											}
											onCheckedChange={() => handleTagGroupToggle(tag)}
											id={`tag-${tag}`}
										/>
										<Label
											htmlFor={`tag-${tag}`}
											className="font-bold text-sm select-none cursor-pointer"
										>
											{tag}
										</Label>
									</div>
									<span className="text-xs text-muted-foreground font-semibold bg-background/80 px-2 py-0.5 rounded-full">
										{tagOps.length} endpoints
									</span>
								</div>
								<CardContent className="p-0 divide-y divide-border/50">
									{tagOps.map((op) => {
										const key = `${op.method.toUpperCase()} ${op.path}`;
										const isChecked = selectedKeys.includes(key);

										return (
											<div
												key={key}
												className={`flex items-start sm:items-center gap-4 px-4 py-3 transition-colors ${
													isChecked ? "bg-primary/5" : "hover:bg-muted/30"
												}`}
											>
												<Checkbox
													checked={isChecked}
													onCheckedChange={() =>
														actions.toggleOperation(op.method, op.path)
													}
													id={`op-${key}`}
													className="mt-1 sm:mt-0"
												/>
												<label
													htmlFor={`op-${key}`}
													className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 cursor-pointer select-none"
												>
													<span
														className={`text-[10px] font-extrabold px-2 py-1 rounded border min-w-[70px] text-center tracking-wide inline-block ${
															METHOD_COLORS[op.method.toUpperCase()] ||
															"bg-slate-500/10 text-slate-600 border-slate-500/20"
														}`}
													>
														{op.method.toUpperCase()}
													</span>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-semibold font-mono truncate text-foreground">
															{op.path}
														</p>
														{op.summary && (
															<p className="text-xs text-muted-foreground line-clamp-1">
																{op.summary}
															</p>
														)}
													</div>
												</label>
											</div>
										);
									})}
								</CardContent>
							</Card>
						);
					})
				)}
			</div>

			{/* Float Action Sticky / Bottom Bar */}
			<div className="flex items-center justify-between border-t pt-4 mt-2">
				<div className="text-sm">
					<span className="font-extrabold text-primary">
						{selectedKeys.length}
					</span>{" "}
					of <span className="font-semibold">{operations.length}</span>{" "}
					endpoints selected
				</div>
				<Button
					onClick={actions.extract}
					disabled={selectedKeys.length === 0}
					className="px-6 py-5 rounded-xl cursor-pointer font-bold shadow-lg shadow-primary/10 transition hover:shadow-primary/20"
				>
					<SparklesIcon className="mr-2 h-4 w-4" /> Extract Selected Paths
				</Button>
			</div>
		</div>
	);
}
