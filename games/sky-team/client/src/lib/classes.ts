// Class lists shared by several components.

/** A space or token on the control panel: 44px on phones, 48px on desktop. */
export const SLOT_SIZE = 'size-11 desktop:size-12';

/** A dotted-underlined word that opens a popover; `after:` gives it a 44px touch area. */
export const POPOVER_TRIGGER =
  'relative font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50';
