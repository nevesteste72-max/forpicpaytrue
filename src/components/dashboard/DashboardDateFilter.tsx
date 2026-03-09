import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type DateFilterOption = "today" | "week" | "month" | "all" | "custom";

interface DashboardDateFilterProps {
  selected: DateFilterOption;
  onFilterChange: (option: DateFilterOption) => void;
  customRange: { from: Date | undefined; to: Date | undefined };
  onCustomRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

const filterOptions: { value: DateFilterOption; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Máximo" },
  { value: "custom", label: "Personalizado" },
];

export function getDateRange(option: DateFilterOption, customRange?: { from: Date | undefined; to: Date | undefined }) {
  const now = new Date();

  switch (option) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "all":
      return { from: new Date(2020, 0, 1), to: endOfDay(now) };
    case "custom":
      return {
        from: customRange?.from ? startOfDay(customRange.from) : startOfMonth(now),
        to: customRange?.to ? endOfDay(customRange.to) : endOfDay(now),
      };
  }
}

export function DashboardDateFilter({
  selected,
  onFilterChange,
  customRange,
  onCustomRangeChange,
}: DashboardDateFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const activeLabel = filterOptions.find((f) => f.value === selected)?.label || "Filtro";

  const displayLabel = selected === "custom" && customRange.from && customRange.to
    ? `${format(customRange.from, "dd MMM", { locale: pt })} - ${format(customRange.to, "dd MMM", { locale: pt })}`
    : activeLabel;

  return (
    <div className="flex items-center gap-1.5">
      {/* Quick filter pills */}
      <div className="flex gap-0.5 bg-card rounded-lg p-0.5 border border-border shadow-sm">
        {filterOptions.slice(0, 4).map((opt) => (
          <Button
            key={opt.value}
            variant={selected === opt.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(opt.value)}
            className={cn(
              "rounded-md text-[10px] md:text-xs h-7 px-2.5 md:px-3",
              selected === opt.value
                ? "bg-foreground text-background shadow-sm hover:bg-foreground/90"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Custom date range picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selected === "custom" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (selected !== "custom") onFilterChange("custom");
            }}
            className={cn(
              "rounded-lg text-[10px] md:text-xs h-7 px-2.5 gap-1.5",
              selected === "custom"
                ? "bg-foreground text-background shadow-sm hover:bg-foreground/90"
                : "border-border text-muted-foreground"
            )}
          >
            <CalendarIcon className="w-3 h-3" />
            <span className="hidden sm:inline">{selected === "custom" ? displayLabel : "Personalizado"}</span>
            <span className="sm:hidden">
              <CalendarIcon className="w-3 h-3" />
            </span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-foreground">Selecione o período</p>
            {customRange.from && customRange.to && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {format(customRange.from, "dd/MM/yyyy", { locale: pt })} — {format(customRange.to, "dd/MM/yyyy", { locale: pt })}
              </p>
            )}
          </div>
          <Calendar
            mode="range"
            selected={customRange.from && customRange.to ? { from: customRange.from, to: customRange.to } : undefined}
            onSelect={(range) => {
              onCustomRangeChange({ from: range?.from, to: range?.to });
              if (range?.from && range?.to) {
                onFilterChange("custom");
                setCalendarOpen(false);
              }
            }}
            numberOfMonths={1}
            locale={pt}
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
