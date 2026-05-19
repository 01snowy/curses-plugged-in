import React, { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { PluginManager } from "@/server/plugins";
import { MdExpandMore, MdExpandLess, MdCheckCircle, MdError } from "react-icons/md";
import classNames from "classnames";

interface PluginPanelProps {
  pluginManager: PluginManager | null;
  className?: string;
}

interface PluginItemUI {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  loaded: boolean;
  error?: string;
}

/**
 * Plugin management panel
 * Shows active plugins, their status, and allows control
 */
export const PluginPanel: React.FC<PluginPanelProps> = ({
  pluginManager,
  className = "",
}) => {
  const [plugins, setPlugins] = useState<PluginItemUI[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pluginManager) {
      setLoading(false);
      return;
    }

    // Initialize plugins list
    const updatePlugins = () => {
      const pluginsList: PluginItemUI[] = pluginManager.getPluginStatuses();
      setPlugins(pluginsList);
      setLoading(false);
    };

    updatePlugins();

    // Listen for plugin changes
    const interval = setInterval(updatePlugins, 1000);
    return () => clearInterval(interval);
  }, [pluginManager]);

  if (!pluginManager || plugins.length === 0) {
    return (
      <div
        className={classNames(
          "p-4 text-sm text-base-content/60 bg-base-200/50 rounded-lg",
          className
        )}
      >
        {loading ? "Loading plugins..." : "No plugins available"}
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  return (
    <div className={classNames("flex max-h-full min-h-0 flex-col space-y-2", className)}>
      <div className="text-xs font-bold text-base-content/70 uppercase tracking-wider px-2 py-1">
        Plugins ({plugins.filter((p) => p.loaded).length}/{plugins.length})
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className="bg-base-200/50 rounded-lg border border-base-300/50 overflow-hidden"
        >
          <button
            onClick={() => toggleExpanded(plugin.id)}
            className="w-full p-3 flex items-center justify-between hover:bg-base-300/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Status indicator */}
              <div className="flex-shrink-0">
                {plugin.error ? (
                  <MdError className="text-error text-lg" title="Error" />
                ) : plugin.loaded ? (
                  <MdCheckCircle className="text-success text-lg" title="Loaded" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-base-content/30" />
                )}
              </div>

              {/* Plugin info */}
              <div className="min-w-0 text-left">
                <div className="font-semibold text-sm text-base-content">
                  {plugin.name}
                </div>
                <div className="text-xs text-base-content/60">v{plugin.version}</div>
              </div>
            </div>

            {/* Expand icon */}
            <div className="flex-shrink-0 ml-2">
              {expanded.has(plugin.id) ? (
                <MdExpandLess className="text-lg" />
              ) : (
                <MdExpandMore className="text-lg" />
              )}
            </div>
          </button>

          {/* Expanded details */}
          {expanded.has(plugin.id) && (
            <div className="px-3 pb-3 border-t border-base-300/50 space-y-2 bg-base-300/30">
              {plugin.description && (
                <p className="text-xs text-base-content/70">{plugin.description}</p>
              )}

              {plugin.error && (
                <div className="text-xs text-error bg-error/10 p-2 rounded border border-error/20">
                  <div className="font-semibold">Error:</div>
                  <div className="mt-1 font-mono text-[10px] break-words">
                    {plugin.error}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  disabled={!plugin.loaded}
                  className="btn btn-xs btn-ghost gap-1"
                  title={plugin.loaded ? "Plugin loaded" : "Plugin not loaded"}
                >
                  {plugin.loaded ? "✓ Active" : "○ Inactive"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
};

export default PluginPanel;
