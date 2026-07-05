export default function Footer() {
	const currentYear = new Date().getFullYear();
	const copyrightText =
		currentYear > 2026 ? `© 2026 - ${currentYear}` : "© 2026";

	return (
		<footer className="mt-auto border-t border-[var(--line)] px-4 py-8 text-[var(--sea-ink-soft)] bg-background/20 backdrop-blur-sm">
			<div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left text-sm font-medium">
				<p className="m-0">
					{copyrightText} OpenAPI Extractor. All rights reserved.
				</p>
				<p className="m-0 text-xs sm:text-sm tracking-wide">
					by <span className="font-extrabold text-foreground">Aryo</span>
				</p>
			</div>
		</footer>
	);
}
