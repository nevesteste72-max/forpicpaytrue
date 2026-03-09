import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  error,
  label = "Número de Telefone",
  placeholder = "84 XXX XXXX",
}: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits and format nicely
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    onChange(digits);
  };

  const formattedValue = value
    ? `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5, 9)}`.trim()
    : "";

  return (
    <div className="space-y-2">
      <Label htmlFor="phone" className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
          <Phone className="w-4 h-4" />
          <span className="text-sm font-medium">+258</span>
        </div>
        <Input
          id="phone"
          type="tel"
          value={formattedValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "pl-24 h-14 text-lg rounded-xl border-2 transition-colors",
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-border focus-visible:ring-primary"
          )}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
