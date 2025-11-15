import { Parser } from "expr-eval";

const parser = new Parser({
  operators: {
    // By default, expr-eval allows assignment, which we don't want for security/simplicity.
    // We can add more custom functions if needed.
    assignment: false,
  },
});

export function evaluateFormula(formula: string, context: Record<string, any>): { value: any; error: string | null } {
  try {
    // Sanitize context keys to be valid variable names if necessary
    // For example, replace dots or hyphens if node IDs contain them
    // const sanitizedContext = Object.fromEntries(
    //   Object.entries(context).map(([key, value]) => [key.replace(/[^a-zA-Z0-9_]/g, '_'), value])
    // );
    // For now, assuming context keys are simple enough (e.g., inputs.Node_A.value)

    const expr = parser.parse(formula);
    const result = expr.evaluate(context);
    return { value: result, error: null };
  } catch (e: any) {
    return { value: null, error: e.message || "Formula evaluation failed" };
  }
}
