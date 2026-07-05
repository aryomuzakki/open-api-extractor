import { createFileRoute } from "@tanstack/react-router";
import {
	Code2Icon,
	FileJsonIcon,
	FileTextIcon,
	ScissorsIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "lucide-react";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { ExtractorTool } from "#/features/extractor/ExtractorTool";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<TooltipProvider>
			<main className="page-wrap px-4 pb-16 pt-8 sm:pt-12">
				{/* Hero Tool Section */}
				<section className="flex flex-col gap-6 mb-12">
					<div className="text-center max-w-3xl mx-auto flex flex-col gap-3 mb-4">
						<div className="inline-flex items-center justify-center self-center px-3 py-1 text-xs font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full">
							<ScissorsIcon className="mr-1.5 h-3 w-3" /> CLIENT-ONLY OpenAPI
							UTILITY
						</div>
						<h1 className="display-title text-4xl sm:text-6xl font-black tracking-tight text-[var(--sea-ink)] leading-[1.05]">
							Extract the endpoints you need.
						</h1>
						<p className="text-base sm:text-lg text-[var(--sea-ink-soft)] max-w-2xl mx-auto">
							Load any OpenAPI spec, check the paths you want to keep, and
							download a clean, pruned subset with all schema dependencies
							intact.
						</p>
					</div>

					<div className="w-full">
						<ExtractorTool />
					</div>
				</section>

				{/* How It Works & Explanatory Details Section */}
				<section className="flex flex-col gap-8 border-t border-[var(--line)] pt-12">
					<div className="text-center flex flex-col gap-2 max-w-xl mx-auto">
						<h2 className="display-title text-2xl sm:text-3xl font-bold text-[var(--sea-ink)]">
							Designed for API Consumers & Providers
						</h2>
						<p className="text-sm text-[var(--sea-ink-soft)]">
							Simplify large API contracts into compact integration subsets.
							Safe, local-only processing.
						</p>
					</div>

					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<Code2Icon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								Local-Only Pruning
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Everything runs inside your browser. Your API specifications,
								paths, keys, and schemas are never uploaded to any server.
							</p>
						</article>

						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<FileJsonIcon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								Smart dependency resolution
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Automatically traces and includes all local component reference
								schemas (`$ref`) used by your selected endpoints, pruning
								everything else.
							</p>
						</article>

						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<ZapIcon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								JSON & YAML Support
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Pasted strings or uploaded files can be in JSON or YAML format.
								Output formats can be toggled instantly between JSON and YAML.
							</p>
						</article>

						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<ScissorsIcon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								Regex & Extension Strip
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Strip custom vendor extensions (`x-*` fields) and choose whether
								to retain original tags or only output tags used by selected
								paths.
							</p>
						</article>

						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<ShieldCheckIcon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								Broken Ref Warnings
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Detects and displays warnings or halts on broken references
								inside the final spec, ensuring your subset remains fully valid.
							</p>
						</article>

						<article className="island-shell rounded-2xl p-6 flex flex-col gap-3 bg-background/30">
							<div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
								<FileTextIcon className="h-5 w-5" />
							</div>
							<h3 className="font-bold text-sm text-[var(--sea-ink)]">
								Clean Specs
							</h3>
							<p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">
								Outputs formatted, production-ready schemas with all empty
								objects, tags, and unused components cleaned up.
							</p>
						</article>
					</div>
				</section>
			</main>
			<Toaster position="bottom-center" />
		</TooltipProvider>
	);
}
