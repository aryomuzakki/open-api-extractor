"use client";

import { useStore } from "@tanstack/react-store";
import { Loader2Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { actions, extractorStore } from "./use-extractor-store";

interface HydrationLoaderProps {
	children: ReactNode;
}

export function HydrationLoader({ children }: HydrationLoaderProps) {
	const hydrationStatus = useStore(
		extractorStore,
		(state) => state.hydrationStatus,
	);
	const [mounted, setMounted] = useState(false);
	const [showCancel, setShowCancel] = useState(false);
	const [isAlertOpen, setIsAlertOpen] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Trigger hydration once on mount if in loading state
	useEffect(() => {
		setMounted(true);
		const controller = new AbortController();
		abortControllerRef.current = controller;

		if (extractorStore.state.hydrationStatus === "idle") {
			actions.hydrateFromStorage(controller.signal);
		}

		return () => {
			controller.abort();
		};
	}, []);

	// Delay showing the cancel button to prevent early cancellations
	useEffect(() => {
		if (hydrationStatus === "loading") {
			const timer = setTimeout(() => {
				setShowCancel(true);
			}, 1500);
			return () => clearTimeout(timer);
		} else {
			setShowCancel(false);
		}
	}, [hydrationStatus]);

	// Close confirmation dialog if hydration completes in the background
	useEffect(() => {
		if (hydrationStatus !== "loading") {
			setIsAlertOpen(false);
		}
	}, [hydrationStatus]);

	const handleDiscard = () => {
		abortControllerRef.current?.abort();
		setIsAlertOpen(false);
	};

	if (mounted && hydrationStatus === "loading") {
		return (
			<>
				{/* Loading Overlay */}
				<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-card/85 backdrop-blur-xs transition-all duration-300">
					<Loader2Icon className="h-8 w-8 animate-spin text-primary" />
					<p className="text-sm font-medium text-muted-foreground animate-pulse">
						Restoring your session...
					</p>
					{showCancel && (
						<button
							type="button"
							onClick={() => setIsAlertOpen(true)}
							className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer focus:outline-none"
						>
							Cancel
						</button>
					)}
				</div>

				{/* Muted Children in Background */}
				<div className="opacity-40 pointer-events-none select-none">
					{children}
				</div>

				{/* Confirmation Dialog */}
				<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Discard saved session?</AlertDialogTitle>
							<AlertDialogDescription>
								This will reset your workspace to its empty state. You'll lose
								your previous input and selections.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Keep waiting</AlertDialogCancel>
							<AlertDialogAction onClick={handleDiscard} variant="destructive">
								Discard session
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</>
		);
	}

	return <>{children}</>;
}

export default HydrationLoader;
