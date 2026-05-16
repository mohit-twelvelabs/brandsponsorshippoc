import figma from "@figma/code-connect"

/**
 * Code Connect: BUTTONS-V2
 *
 * Maps the Figma BUTTONS-V2 component set to React + Tailwind code.
 * Figma node: 16043:25456 in file cfmWlO6lq5N4U6cHoquqpw
 *
 * Button variants from Figma:
 * - Styles: Solid, Ghosted, Outline, Outline Blur
 * - Colors: White, Grey, Black, Blur
 * - States: Enabled, Hover, Disabled
 */
figma.connect(
  "https://www.figma.com/design/cfmWlO6lq5N4U6cHoquqpw?node-id=16043-25456",
  {
    props: {
      label: figma.string("Label"),
      variant: figma.enum("Variant", {
        "Enabled: White": "solid-white",
        "Enabled: Grey": "solid-grey",
        "Enabled: Black Ghosted": "ghosted-black",
        "Enabled: White Ghosted": "ghosted-white",
        "Enabled: Blur": "blur",
        "Enabled: Black Outline": "outline-black",
        "Enabled: White Outline": "outline-white",
        "Enabled: White Outline Blur": "outline-blur",
        "Disabled: Black": "disabled-black",
        "Disabled: White": "disabled-white",
        "Disabled: Outline": "disabled-outline",
      }),
    },
    example: (props) => `
<button
  className={cn(
    "inline-flex items-center justify-center gap-2",
    "px-6 py-3 rounded-lg font-system text-base font-medium",
    "transition-colors duration-200",
    {
      "solid-white": "bg-white text-brand-charcoal hover:bg-brand-grey",
      "solid-grey": "bg-brand-grey text-brand-charcoal hover:bg-border-light",
      "ghosted-black": "bg-transparent text-brand-charcoal hover:bg-brand-grey/10",
      "ghosted-white": "bg-transparent text-white hover:bg-white/10",
      "blur": "bg-white/20 backdrop-blur-md text-white hover:bg-white/30",
      "outline-black": "border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white",
      "outline-white": "border border-white text-white hover:bg-white hover:text-brand-charcoal",
      "outline-blur": "border border-white/40 backdrop-blur-md text-white hover:bg-white/10",
      "disabled-black": "bg-brand-charcoal/30 text-text-tertiary cursor-not-allowed",
      "disabled-white": "bg-white/30 text-text-tertiary cursor-not-allowed",
      "disabled-outline": "border border-border text-text-tertiary cursor-not-allowed",
    }["${props.variant}"]
  )}
  disabled={${props.variant?.startsWith("disabled")}}
>
  ${props.label}
</button>`,
  }
)
