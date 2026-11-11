import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES, countryName } from "@/lib/countries";

export const CountryCombobox = ({ value, onChange, testid = "country-select", open: openProp, onOpenChange }) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal border-slate-200" data-testid={testid}>
          <span className="truncate">{value ? `${countryName(value)} (${value})` : "Elegir país…"}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar país…" data-testid={`${testid}-search`} />
          <CommandList>
            <CommandEmpty>No encontrado.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem key={c.code} value={`${c.name} ${c.code}`} onSelect={() => { onChange(c.code); setOpen(false); }} data-testid={`${testid}-opt-${c.code}`}>
                  <Check className={`w-4 h-4 mr-2 ${value === c.code ? "opacity-100" : "opacity-0"}`} />
                  {c.name} <span className="ml-auto text-xs text-slate-400">{c.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
