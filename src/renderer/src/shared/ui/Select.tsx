import * as React from "react"
import { cn } from "@renderer/shared/lib/utils"
import { ChevronDown, Check } from "lucide-react"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SelectOption[]
  value?: string
  placeholder?: string
  onValueChange?: (value: string) => void
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ className, options, value, placeholder = "Select...", onValueChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const selectRef = React.useRef<HTMLDivElement>(null)

    const selectedOption = options.find((opt) => opt.value === value)

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    return (
      <div className="relative inline-block w-full" ref={selectRef}>
        <div
          role="combobox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-10 w-full items-center justify-between cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-accent/50 transition-all",
            className
          )}
          ref={ref}
          {...props}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>

        {isOpen && (
          <div className="absolute top-full z-50 mt-1 w-full min-w-[160px] max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="p-1 space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onValueChange?.(option.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                      isSelected && "bg-accent/50 text-foreground font-medium"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }

