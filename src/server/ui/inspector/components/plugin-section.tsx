import { FC, PropsWithChildren, useState } from "react";
import { HiChevronRight } from "react-icons/hi";
import classNames from "classnames";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  subtitle?: string;
}

/**
 * Collapsible section component for plugin settings
 * Provides clean visual hierarchy with arrow indicator
 */
export const PluginSection: FC<SectionProps> = ({ 
  title, 
  children, 
  defaultOpen = true,
  icon,
  subtitle
}) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="border-l-2 border-base-300 pl-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-2 w-full font-semibold text-sm text-base-content/80 hover:text-base-content transition-colors"
      >
        <HiChevronRight 
          className={classNames("text-xs transition-transform flex-shrink-0", open && "rotate-90")}
        />
        <span className="flex-grow text-left flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </span>
      </button>
      {subtitle && (
        <p className="text-[10px] text-base-content/60 ml-6 -mt-1 mb-1">{subtitle}</p>
      )}
      {open && <div className="space-y-2 mt-2 ml-2">{children}</div>}
    </div>
  );
};

interface SettingGroupProps {
  children: React.ReactNode;
  background?: boolean;
  padding?: boolean;
}

/**
 * Visual grouping container for related settings
 */
export const SettingGroup: FC<SettingGroupProps> = ({ 
  children, 
  background = true,
  padding = true
}) => {
  return (
    <div 
      className={classNames(
        "rounded",
        background && "bg-base-300/20",
        padding && "p-2"
      )}
    >
      {children}
    </div>
  );
};

interface HelpBoxProps {
  children: React.ReactNode;
  type?: "info" | "tip" | "warning";
}

/**
 * Styled help/info box for plugin settings
 */
export const HelpBox: FC<HelpBoxProps> = ({ children, type = "info" }) => {
  const icons = {
    info: "ℹ️",
    tip: "💡",
    warning: "⚠️"
  };

  const bgColors = {
    info: "bg-info/10",
    tip: "bg-success/10",
    warning: "bg-warning/10"
  };

  const borderColors = {
    info: "border-info/30",
    tip: "border-success/30",
    warning: "border-warning/30"
  };

  return (
    <div className={classNames(
      "p-2 rounded text-[10px] text-base-content/60 border",
      bgColors[type],
      borderColors[type]
    )}>
      <span className="font-semibold mr-1">{icons[type]}</span>
      {children}
    </div>
  );
};

interface TokenDisplayProps {
  tokens: Array<{ code: string; description: string }>;
}

/**
 * Formatted display of template tokens with descriptions
 */
export const TokenDisplay: FC<TokenDisplayProps> = ({ tokens }) => {
  return (
    <div className="text-[10px] text-base-content/60 space-y-1 ml-2 bg-base-200/30 p-2 rounded">
      {tokens.map((token, idx) => (
        <div key={idx}>
          <code className="bg-base-200 px-1 rounded">{token.code}</code> 
          <span className="ml-2">- {token.description}</span>
        </div>
      ))}
    </div>
  );
};

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Single setting row with label, description, and control
 */
export const SettingRow: FC<SettingRowProps> = ({ label, description, children }) => {
  return (
    <div>
      <div className="font-medium text-sm text-base-content/80">{label}</div>
      {description && (
        <p className="text-[10px] text-base-content/60 mt-0.5">{description}</p>
      )}
      <div className="mt-1">
        {children}
      </div>
    </div>
  );
};
