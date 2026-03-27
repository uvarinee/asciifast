import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}) {
  const _values = React.useMemo(() =>
    Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : [min, max], [value, defaultValue, min, max])

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}>
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-[#333333] data-[orientation=horizontal]:h-[2px] data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[2px]"
        )}>
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute rounded-full bg-[#E6E6E6] data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )} />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-[16px] shrink-0 rounded-full border-2 border-[#0D0D0D] bg-[#E6E6E6] shadow-none transition-[box-shadow,transform] hover:scale-[1.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50" />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider }
