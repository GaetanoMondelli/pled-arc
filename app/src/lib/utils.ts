import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function replaceTemplateVariables(template: any, variables: any) {
  const result = { ...template };

  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      result[key] = result[key].replace(/\{\{([^}]+)\}\}/g, (match: string, path: string) => {
        const value = path.split(".").reduce((obj: any, key: string) => obj?.[key], variables);
        return value ?? match;
      });
    }
  }

  return result;
}
