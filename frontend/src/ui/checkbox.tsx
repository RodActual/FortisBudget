import * as React from "react";
import { Check } from "lucide-react"; // use a real icon

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
  checked?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    return (
      <div
        className="relative flex items-center justify-center w-5 h-5 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onCheckedChange?.(!checked);
        }}
      >
        <div
          className={`
            h-4 w-4 shrink-0 rounded border transition-all flex items-center justify-center
            ${checked ? "bg-black" : "bg-white border-slate-400"}
          `}
        >
          {checked && (
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          )}
        </div>
        <input
          type="checkbox"
          ref={ref}
          checked={checked ?? false}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only"
          {...props}
        />
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";