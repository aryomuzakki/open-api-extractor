import { useEffect, useState } from "react";

export function useThemeObserver() {
	const [theme, setTheme] = useState<"vs-dark" | "light">(() => {
		if (typeof window === "undefined") return "vs-dark";
		return document.documentElement.classList.contains("dark")
			? "vs-dark"
			: "light";
	});

	useEffect(() => {
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "vs-dark" : "light");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		// Initial check
		const isDark = document.documentElement.classList.contains("dark");
		setTheme(isDark ? "vs-dark" : "light");

		return () => observer.disconnect();
	}, []);

	return theme;
}
