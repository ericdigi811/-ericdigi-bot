import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, AlertCircle, Wifi, WifiOff } from "lucide-react";

type BotStatus = "connected" | "disconnected" | "connecting";

interface StatusIndicatorProps {
  status: BotStatus;
  className?: string;
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = {
    connected: {
      label: "Connecté",
      color: "bg-emerald-500",
      bgSubtle: "bg-emerald-500/10",
      textColor: "text-emerald-700 dark:text-emerald-400",
      borderColor: "border-emerald-500/20",
      icon: <Wifi className="w-3.5 h-3.5 mr-1.5" />,
      ping: true,
    },
    connecting: {
      label: "Connexion en cours...",
      color: "bg-amber-500",
      bgSubtle: "bg-amber-500/10",
      textColor: "text-amber-700 dark:text-amber-400",
      borderColor: "border-amber-500/20",
      icon: <Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />,
      ping: false,
    },
    disconnected: {
      label: "Déconnecté",
      color: "bg-rose-500",
      bgSubtle: "bg-rose-500/10",
      textColor: "text-rose-700 dark:text-rose-400",
      borderColor: "border-rose-500/20",
      icon: <WifiOff className="w-3.5 h-3.5 mr-1.5" />,
      ping: false,
    },
  };

  const current = config[status];

  return (
    <div className={cn("flex items-center", className)}>
      <Badge 
        variant="outline" 
        className={cn(
          "px-3 py-1.5 font-medium rounded-full border shadow-sm transition-colors duration-300",
          current.bgSubtle,
          current.textColor,
          current.borderColor
        )}
      >
        {current.icon}
        <span className="relative flex h-2 w-2 mr-2">
          {current.ping && (
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", current.color)}></span>
          )}
          <span className={cn("relative inline-flex rounded-full h-2 w-2", current.color)}></span>
        </span>
        {current.label}
      </Badge>
    </div>
  );
}
