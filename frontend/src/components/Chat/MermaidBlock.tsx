import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
        primaryColor: "#3b82f6",
        primaryTextColor: "#f5f5f4",
        primaryBorderColor: "#52525b",
        lineColor: "#a8a29e",
        secondaryColor: "#27272a",
        tertiaryColor: "#18181b",
        background: "#18181b",
        mainBkg: "#27272a",
        nodeBorder: "#52525b",
        clusterBkg: "#27272a",
        clusterBorder: "#52525b",
        titleColor: "#f5f5f4",
        edgeLabelBackground: "#27272a",
    },
    flowchart: {
        htmlLabels: true,
        curve: "basis",
    },
    securityLevel: "loose",
});

type Props = { chart: string };

/**
 * Preprocess mermaid code to fix common syntax issues
 */
function preprocessMermaid(code: string): string {
    let cleaned = code.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/^```mermaid\s*/i, "").replace(/```\s*$/i, "").trim();

    // Replace single quotes in node IDs: A' -> A_p, A'C' -> A_pC_p
    cleaned = cleaned.replace(/([A-Z])'/g, "$1_p");

    // Wrap subgraph names with non-ASCII in quotes
    cleaned = cleaned.replace(
        /^(\s*subgraph\s+)([^\n"]+)$/gm,
        (_, prefix, name) => {
            const trimmed = name.trim();
            if (/[^\x00-\x7F]/.test(trimmed)) {
                return `${prefix}"${trimmed}"`;
            }
            return `${prefix}${trimmed}`;
        }
    );

    // Fix arrow with label syntax: A --- "label" --> B should be A -->|label| B
    cleaned = cleaned.replace(
        /(\w+)\s*---\s*"([^"]+)"\s*-->\s*(\w+)/g,
        '$1 -->|$2| $3'
    );

    // Fix standalone --- arrows (should be ---)
    cleaned = cleaned.replace(/\s+---\s+/g, " --- ");
    cleaned = cleaned.replace(/\s+-->\s+/g, " --> ");

    // Remove LaTeX syntax completely
    cleaned = cleaned.replace(/\$[^$]*\$/g, (match) => {
        return match
            .replace(/\$/g, "")
            .replace(/\\vec\{([^}]+)\}/g, "$1")
            .replace(/\\overrightarrow\{([^}]+)\}/g, "$1")
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2")
            .replace(/\\[a-z]+/gi, "")
            .replace(/[{}^_]/g, "");
    });

    return cleaned;
}

/**
 * Convert mermaid code to a readable ASCII-like format for fallback display
 */
function toReadableFormat(code: string): string {
    // Clean up and format nicely
    const lines = code.split('\n').map(l => l.trim()).filter(Boolean);
    let result: string[] = [];
    let indent = 0;

    for (const line of lines) {
        if (line.startsWith('end')) {
            indent = Math.max(0, indent - 1);
        }

        const prefix = '  '.repeat(indent);

        // Format arrows nicely
        let formatted = line
            .replace(/-->/g, '  →  ')
            .replace(/---/g, '  —  ')
            .replace(/\[([^\]]+)\]/g, '[$1]')
            .replace(/\{([^}]+)\}/g, '⟨$1⟩');

        result.push(prefix + formatted);

        if (line.startsWith('subgraph') || line.includes('{')) {
            indent++;
        }
    }

    return result.join('\n');
}

export default function MermaidBlock({ chart }: Props) {
    const uniqueId = useId().replace(/:/g, "_");
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const render = async () => {
            if (!chart?.trim()) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError("");
            setSvg("");

            try {
                const id = `mermaid_${uniqueId}_${Date.now()}`;
                const cleanChart = preprocessMermaid(chart);

                console.log("[Mermaid] Rendering:", cleanChart.slice(0, 200));

                const { svg: renderedSvg } = await mermaid.render(id, cleanChart);

                if (!cancelled) {
                    setSvg(renderedSvg);
                    setError("");
                }
            } catch (err: any) {
                console.error("[Mermaid] Render error:", err?.message?.slice(0, 100));
                if (!cancelled) {
                    setError(err?.message || "Failed to render diagram");
                    setSvg("");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        const timer = setTimeout(render, 50);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [chart, uniqueId]);

    // Fallback: Show nicely formatted diagram code
    if (error) {
        const readable = toReadableFormat(chart);
        return (
            <div className="my-4 p-4 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 overflow-x-auto">
                <div className="flex items-center gap-2 text-xs text-stone-400 mb-3">
                    <span>📊</span>
                    <span>Diagram</span>
                </div>
                <pre className="text-sm text-stone-200 whitespace-pre-wrap font-mono leading-relaxed">{readable}</pre>
            </div>
        );
    }

    if (isLoading || !svg) {
        return (
            <div className="my-4 p-4 rounded-lg bg-zinc-900 border border-zinc-700 animate-pulse">
                <div className="h-24 flex items-center justify-center text-stone-500">
                    Loading diagram...
                </div>
            </div>
        );
    }

    return (
        <div
            className="my-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 overflow-x-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
