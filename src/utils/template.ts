import { template as lodashTemplate } from 'lodash-es';
import createDebug from 'debug';
import type { TemplateContext } from '../types.js';

const debug = createDebug('forgejo-semantic-release:template');

/**
 * Compile and execute a Lodash template with the given context
 */
export function compileTemplate(
  templateString: string,
  context: Partial<TemplateContext>
): string {
  try {
    const compiled = lodashTemplate(templateString);
    return compiled(context);
  } catch (error) {
    debug('Template compilation failed: %s', (error as Error).message);
    // Return the original string if template fails
    return templateString;
  }
}

/**
 * Evaluate a template condition (returns boolean)
 */
export function evaluateCondition(
  conditionTemplate: string,
  context: Partial<TemplateContext>
): boolean {
  try {
    const compiled = lodashTemplate(conditionTemplate);
    const result = compiled(context);
    // Treat any truthy value as true
    return Boolean(result && result !== 'false' && result !== '0');
  } catch (error) {
    debug('Condition evaluation failed: %s', (error as Error).message);
    // Default to true if evaluation fails
    return true;
  }
}
