import { clsx, type ClassValue } from "clsx";

/** Join class names. (No tailwind-merge: it would treat `text-display` and `text-ink` as one group.) */
export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
