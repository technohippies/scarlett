/**
 * Generates a prompt for an LLM to suggest relevant hashtags for given content,
 * optionally biasing towards an existing list of tags.
 * 
 * @param title The title of the webpage.
 * @param url The URL of the webpage.
 * @param contentSummary The Markdown summary of the page content.
 * @param existingTags Optional array of existing tag names (e.g., ['#technology', '#ai']).
 * @param maxTags The desired number of tags (default 3).
 * @returns A string containing the formatted prompt.
 */
export function getTagSuggestionPrompt(
  title: string,
  url: string,
  contentSummary: string,
  existingTags?: string[],
  maxTags: number = 3
): string {
  let prompt = `Analyze the **subject matter** of the following webpage content summary and suggest **up to ${maxTags}** relevant category hashtags (starting with #). Focus on tags that describe the core topic discussed.\n\n    **IMPORTANT:** Your goal is to categorize the **topic** of the text, NOT the source (e.g., don't just tag it as #article or #reference if the topic is specific). If the content summary is too short, generic, lacks clear topics, or doesn't match any suitable categories, DO NOT SUGGEST ANY TAGS. Output nothing.\n\n`;

  if (title) {
    prompt += `Title: ${title}\n`;
  }
  if (url) {
    prompt += `URL: ${url}\n`;
  }
  prompt += `Content Summary (Markdown):\n${contentSummary}\n`;

  if (existingTags && existingTags.length > 0) {
    const tagList = existingTags.join(' ');
    prompt += `\nExisting Tag List: ${tagList}\n`;
    prompt += `\nInstruction:\n1. Check if any tags in the 'Existing Tag List' are a **STRONG and DIRECT match** for the **main subject matter** described in the 'Content Summary'.\n2. If YES, select up to ${maxTags} of those strongly matching existing tags.\n3. If **NO** existing tags are a strong match for the subject matter, **IGNORE THE EXISTING TAG LIST COMPLETELY**. Instead, generate 1-${maxTags} **NEW** hashtags that accurately describe the core topic(s) of the 'Content Summary'.\n4. Do not suggest tags if unsure or if the content is too generic.\n`;
  } else {
    prompt += `\nInstruction: Please suggest 1-${maxTags} **NEW** hashtags that accurately describe the core topic(s) of the 'Content Summary'. Do not suggest tags if the content is unclear, lacks specific topics, or if you are unsure.\n`;
  }

  prompt += `\nOutput ONLY the suggested hashtags (e.g., #topic1 #topic2), each starting with #, separated by spaces. If no tags are relevant, output nothing.`;

  return prompt;
} 