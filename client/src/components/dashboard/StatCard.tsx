import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export function StatCard({ title, value, icon, description, trend, isLoading }: StatCardProps) {
  return (
    <Card className="hover-elevate overflow-hidden border-slate-200/60 shadow-sm relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 pointer-events-none" />
      
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md mt-1" />
              ) : (
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {value}
                </h2>
              )}
              
              {trend && !isLoading && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  trend.isPositive 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" 
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                )}>
                  {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                </span>
              )}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-inner">
            {icon}
          </div>
        </div>
        
        {description && !isLoading && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
