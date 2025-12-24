import { useState } from "react";
import { useLanguage } from "../lib/LanguageContext";
import PodcastGenerator from "../components/Tools/PodcastGenerator";
import Transcriber from "../components/Tools/Transcriber";
import SmartNotes from "../components/Tools/SmartNotes";

type ToolId = "podcast" | "transcriber" | "notes" | "planner" | null;

export default function Tools() {
  const { t } = useLanguage();
  const [activeTool, setActiveTool] = useState<ToolId>(null);

  const tools = [
    {
      id: "podcast" as ToolId,
      name: t.tools.podcast,
      icon: "🎙️",
      description: t.tools.podcastTool.description,
      color: "purple",
      ready: true
    },
    {
      id: "transcriber" as ToolId,
      name: t.tools.transcriber,
      icon: "✍️",
      description: t.tools.transcriberTool.description,
      color: "orange",
      ready: true
    },
    {
      id: "notes" as ToolId,
      name: t.tools.notes,
      icon: "📓",
      description: t.tools.smartNotesTool.description,
      color: "sky",
      ready: true
    },
    {
      id: "planner" as ToolId,
      name: t.tools.planner,
      icon: "📅",
      description: t.tools.toolsDesc,
      color: "blue",
      ready: false
    },
  ];

  const colorClasses: Record<string, { border: string; shadow: string; bg: string; text: string }> = {
    purple: {
      border: "hover:border-purple-500/50 active:border-purple-500",
      shadow: "hover:shadow-purple-500/20",
      bg: "from-purple-500/20 to-pink-500/20",
      text: "text-purple-400"
    },
    orange: {
      border: "hover:border-orange-500/50 active:border-orange-500",
      shadow: "hover:shadow-orange-500/20",
      bg: "from-orange-500/20 to-red-500/20",
      text: "text-orange-400"
    },
    sky: {
      border: "hover:border-sky-500/50 active:border-sky-500",
      shadow: "hover:shadow-sky-500/20",
      bg: "from-sky-500/20 to-blue-500/20",
      text: "text-sky-400"
    },
    blue: {
      border: "hover:border-blue-500/50 active:border-blue-500",
      shadow: "hover:shadow-blue-500/20",
      bg: "from-blue-500/20 to-cyan-500/20",
      text: "text-blue-400"
    },
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case "podcast":
        return <PodcastGenerator />;
      case "transcriber":
        return <Transcriber />;
      case "notes":
        return <SmartNotes />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full px-4 lg:pl-28 lg:pr-4 py-8">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 flex items-center justify-center gap-4">
            {t.tools.title}
            <span className="text-xs bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full border border-sky-500/20 uppercase tracking-widest font-black">
              {t.common.beta}
            </span>
          </h1>
          <p className="text-stone-400 text-base max-w-2xl mx-auto">
            {t.tools.toolsDesc}
          </p>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {tools.map((tool) => {
            const colors = colorClasses[tool.color];
            const isActive = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => tool.ready && setActiveTool(isActive ? null : tool.id)}
                disabled={!tool.ready}
                className={`
                  relative p-4 rounded-2xl bg-stone-900/60 border transition-all duration-300
                  ${tool.ready
                    ? `border-stone-800 ${colors.border} hover:shadow-lg ${colors.shadow} cursor-pointer`
                    : "border-stone-800/50 opacity-50 cursor-not-allowed"
                  }
                  ${isActive ? `border-${tool.color}-500 shadow-lg ${colors.shadow} bg-gradient-to-br ${colors.bg}` : ""}
                `}
              >
                <div className="text-3xl mb-2">{tool.icon}</div>
                <h3 className="text-white font-semibold text-sm mb-1">{tool.name}</h3>
                {tool.ready ? (
                  <div className={`text-[10px] ${colors.text} font-medium uppercase tracking-wider`}>
                    {isActive ? t.tools.active : t.tools.ready}
                  </div>
                ) : (
                  <div className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                    {t.tools.comingSoon}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Tool Content */}
        {activeTool && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                {tools.find(t => t.id === activeTool)?.icon}
                {tools.find(t => t.id === activeTool)?.name}
              </h2>
              <button
                onClick={() => setActiveTool(null)}
                className="text-stone-400 hover:text-white p-2 hover:bg-stone-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderActiveTool()}
          </div>
        )}

        {/* Empty State */}
        {!activeTool && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🛠️</div>
            <p className="text-stone-400 text-lg mb-2">{t.tools.selectTool}</p>
            <p className="text-stone-500 text-sm">{t.tools.clickToOpen}</p>
          </div>
        )}
      </div>
    </div>
  );
}