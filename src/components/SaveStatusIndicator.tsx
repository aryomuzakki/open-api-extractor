"use client";

import { useStore } from "@tanstack/react-store";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	actions,
	extractorStore,
} from "#/features/extractor/use-extractor-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function SaveStatusIndicator() {
	const saveStatus = useStore(extractorStore, (state) => state.saveStatus);
	const [mounted, setMounted] = useState(false);

	// Avoid SSR hydration mismatches
	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (saveStatus === "saved" || saveStatus === "error") {
			const timer = setTimeout(() => {
				actions.clearSaveStatus();
			}, 2500);
			return () => clearTimeout(timer);
		}
	}, [saveStatus]);

	if (!mounted || saveStatus === "idle") {
		return null;
	}

	let icon = null;
	let text = "";
	let tooltipText = "";
	let colorClass = "text-muted-foreground";

	if (saveStatus === "saving") {
		icon = <Loader2Icon className="h-3.5 w-3.5 animate-spin" />;
		text = "Saving...";
		tooltipText = "Saving changes to local storage";
	} else if (saveStatus === "saved") {
		icon = <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />;
		text = "Saved";
		tooltipText = "All changes saved to local storage";
		colorClass = "text-emerald-500 dark:text-emerald-400";
	} else if (saveStatus === "error") {
		icon = <AlertCircleIcon className="h-3.5 w-3.5 text-destructive" />;
		text = "Save failed";
		tooltipText = "Could not save to local storage (quota exceeded?)";
		colorClass = "text-destructive";
	}

	return (
		<Tooltip>
			<TooltipTrigger>
				<span
					className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-default transition-all duration-300 ${colorClass}`}
				>
					{icon}
					<span className="hidden sm:inline">{text}</span>
				</span>
			</TooltipTrigger>
			<TooltipContent>{tooltipText}</TooltipContent>
		</Tooltip>
	);
}

export default SaveStatusIndicator;
