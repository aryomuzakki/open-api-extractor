import { useStore } from "@tanstack/react-store";
import { ArrowLeftIcon, FileCodeIcon, SparklesIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { HydrationLoader } from "./HydrationLoader";
import { OperationSelector } from "./OperationSelector";
import { OutputPanel } from "./OutputPanel";
import { SpecInput } from "./SpecInput";
import { actions, extractorStore } from "./use-extractor-store";

export function ExtractorTool() {
	const parsedSpec = useStore(extractorStore, (state) => state.parsedSpec);
	const isExtracted = useStore(extractorStore, (state) => state.isExtracted);

	const specTitle = parsedSpec?.info?.title || "OpenAPI Specification";
	const specVersion = parsedSpec?.info?.version || "1.0.0";

	return (
		<Card className="island-shell w-full overflow-hidden rounded-[2rem] border-line bg-linear-to-b from-card to-card/90 shadow-2xl backdrop-blur-md">
			<CardHeader className="border-b border-border/40 pb-6">
				<div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
					<div>
						<CardTitle className="display-title flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
							{parsedSpec ? (
								<>
									<FileCodeIcon className="h-6 w-6 text-primary" />
									<span
										className="truncate max-w-[240px] sm:max-w-[450px]"
										title={specTitle}
									>
										{specTitle}
									</span>
									<span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border border-primary/25 rounded-full">
										v{specVersion}
									</span>
								</>
							) : (
								<>
									<SparklesIcon className="h-6 w-6 text-primary" />
									OpenAPI Path Extractor
								</>
							)}
						</CardTitle>
						<CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
							{isExtracted
								? "Your custom OpenAPI subset has been extracted successfully."
								: parsedSpec
									? "Select which API operations to keep in your new trimmed specification."
									: "Load or paste an OpenAPI JSON/YAML specification to begin pruning."}
						</CardDescription>
					</div>

					{parsedSpec && (
						<Button
							variant="ghost"
							size="sm"
							onClick={actions.reset}
							className="self-start sm:self-auto text-muted-foreground hover:text-foreground cursor-pointer"
						>
							<ArrowLeftIcon className="mr-1.5 h-4 w-4" /> Load different spec
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent className="relative p-6 sm:p-8">
				<HydrationLoader>
					{!parsedSpec && <SpecInput />}

					{parsedSpec && !isExtracted && <OperationSelector />}

					{isExtracted && <OutputPanel />}
				</HydrationLoader>
			</CardContent>
		</Card>
	);
}
export default ExtractorTool;
