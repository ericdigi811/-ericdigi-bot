import { StatusIndicator } from "@/components/StatusIndicator";
import { Bot, Sparkles } from "lucide-react";
import { type Stats } from "@shared/schema";

interface HeaderProps {
  status?: Stats["botStatus"];
}

export function Header({ status = "disconnected" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-700 shadow-md shadow-primary/20 text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight">
                EricDigi
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest -mt-1 flex items-center gap-1">
                WhatsApp AI <Sparkles className="w-3 h-3 text-amber-500" />
              </span>
            </div>
          </div>

          {/* Status Section */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-slate-500 font-medium mr-2">
              Statut du système:
            </div>
            <StatusIndicator status={status} />
          </div>
        </div>
      </div>
    </header>
  );
}
