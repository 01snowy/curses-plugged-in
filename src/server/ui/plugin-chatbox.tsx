import React, { useEffect, useState } from "react";

interface PluginData {
  id: string;
  pluginId: string;
  type: "text" | "alert" | "update";
  content: string;
  icon?: string;
  color?: string;
  duration?: number;
  priority?: number;
}

interface PluginChatBoxProps {
  pluginManager: any;
  maxItems?: number;
  className?: string;
}

/**
 * Chat box component for displaying plugin data
 * Integrates with the plugin system to show dynamic content
 * like current song, weather alerts, stream notifications, etc.
 */
export const PluginChatBox: React.FC<PluginChatBoxProps> = ({
  pluginManager,
  maxItems = 5,
  className = "",
}) => {
  const [items, setItems] = useState<PluginData[]>([]);

  useEffect(() => {
    if (!pluginManager) return;

    const handleData = (data: PluginData) => {
      setItems((prev) => {
        const updated = [data, ...prev];
        // Sort by priority (higher first)
        updated.sort((a, b) => (b.priority || 5) - (a.priority || 5));
        return updated.slice(0, maxItems);
      });

      // Auto-remove if duration specified
      if (data.duration && data.duration > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== data.id));
        }, data.duration);
      }
    };

    pluginManager.on("plugin:data", handleData);

    return () => {
      pluginManager.off("plugin:data", handleData);
    };
  }, [pluginManager, maxItems]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`plugin-chatbox space-y-2 p-4 max-w-md ${className}`}
      style={{
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI'",
      }}
    >
      {items.map((item) => (
        <PluginChatItem key={item.id} item={item} />
      ))}
    </div>
  );
};

interface PluginChatItemProps {
  item: PluginData;
}

const PluginChatItem: React.FC<PluginChatItemProps> = ({ item }) => {
  const getTypeClass = (type: string) => {
    switch (type) {
      case "alert":
        return "bg-red-500 border-l-red-700";
      case "update":
        return "bg-blue-500 border-l-blue-700";
      default:
        return "bg-gray-700 border-l-gray-900";
    }
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case "alert":
        return "🔔";
      case "update":
        return "ℹ️";
      default:
        return "💬";
    }
  };

  const typeClass = getTypeClass(item.type);
  const typeEmoji = getTypeEmoji(item.type);

  return (
    <div
      className={`plugin-item p-3 rounded-lg border-l-4 text-white shadow-lg backdrop-blur-sm ${typeClass}`}
      style={{
        opacity: item.duration === 0 ? 1 : 0.85,
        borderLeftColor: item.color || undefined,
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">
          {item.icon || typeEmoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight break-words">
            {item.content}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginChatBox;
