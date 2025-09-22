import React, { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = "text",
  placeholder = "Enter text",
  className = "",
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      placeholder={placeholder}
      className={`px-4 py-2 w-full rounded border-2 shadow-md transition focus:outline-hidden focus:shadow-xs ${
        props["aria-invalid"]
          ? "border-destructive text-destructive shadow-xs shadow-destructive"
          : ""
      } ${className}`}
      {...props}
    />
  );
});

Input.displayName = "Input";
