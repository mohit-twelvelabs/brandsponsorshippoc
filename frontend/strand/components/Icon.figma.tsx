import figma from "@figma/code-connect"

/**
 * Code Connect: ICONS-V2
 *
 * Maps the Figma ICONS-V2 component set to React + Tailwind code.
 * Figma node: 16153:23653 in file cfmWlO6lq5N4U6cHoquqpw
 *
 * Functional icon set from the TwelveLabs design system.
 * Icons are rendered as inline SVGs with Tailwind sizing classes.
 */
figma.connect(
  "https://www.figma.com/design/cfmWlO6lq5N4U6cHoquqpw?node-id=16153-23653",
  {
    props: {
      name: figma.string("Name"),
      size: figma.enum("Size", {
        "16": "w-4 h-4",
        "20": "w-5 h-5",
        "24": "w-6 h-6",
        "32": "w-8 h-8",
      }),
    },
    example: (props) => `
<svg
  className="${props.size} text-current shrink-0"
  fill="none"
  viewBox="0 0 24 24"
  stroke="currentColor"
  strokeWidth={2}
  aria-hidden="true"
>
  {/* Icon: ${props.name} */}
  {/* Import from your icon library or use inline SVG paths */}
</svg>`,
  }
)
