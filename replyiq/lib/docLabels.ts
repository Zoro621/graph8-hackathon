// Studio campaign documents are identified by file_type ("messaging_objections"); people see these names.
const DOC_LABEL: Record<string, string> = {
  campaign_brief: "Campaign Brief",
  messaging_objections: "Messaging & Objections",
  reply_templates: "Reply Templates",
  targeting_routing: "Targeting & Routing",
  email_prompt: "Email Prompt",
  emails: "Emails",
  email_copy: "Emails",
  snippets: "Snippets",
  sequence: "Sequence",
  step_catalog: "Step Catalog",
};

/** "messaging_objections" → "Messaging & Objections"; unknown types read as words ("new_doc" → "new doc"). */
export const docLabel = (fileType: string) => DOC_LABEL[fileType] ?? fileType.replace(/_/g, " ");

export const docList = (fileTypes: string[]) => fileTypes.map(docLabel).join(", ");
