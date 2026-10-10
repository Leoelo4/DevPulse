"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon, hint: "Default" },
  { value: "light", label: "Light", icon: Sun, hint: "" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your OS setting" },
] as const;

const subscribe = () => () => {};

export function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const value = hydrated ? (theme ?? "dark") : "dark";

  return (
    <RadioGroup
      value={value}
      onValueChange={setTheme}
      aria-label="Colour theme"
      className="grid gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map(({ value: optionValue, label, icon: Icon, hint }) => (
        <Label
          key={optionValue}
          htmlFor={`theme-${optionValue}`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
        >
          <RadioGroupItem id={`theme-${optionValue}`} value={optionValue} className="mt-0.5" />
          <span className="space-y-0.5">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Icon className="size-3.5" aria-hidden /> {label}
            </span>
            {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}
