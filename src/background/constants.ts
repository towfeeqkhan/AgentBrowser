export const DEBUGGER_VERSION = "1.3";

export const INTERACTIVE_ROLES = new Set([
  "button",
  "textbox",
  "link",
  "checkbox",
  "radio",
  "combobox",
  "menuitem",
]);

export const TEXT_ROLES = new Set(["heading", "statictext", "text"]);

export const NEGATIVE_KEYWORDS = [
  "footer",
  "privacy",
  "terms",
  "legal",
  "careers",
  "advert",
  "sponsored",
  "cookie",
  "abebooks",
  "shopbop",
  "goodreads",
  "imdb",
  "customer image",
  "customer images",
  "deals",
  "gift cards",
  "prime",
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "newsletter",
];

export const BUILTIN_DISMISSALS = [
  { selector: '[class*="cookie"] button[class*="accept" i]', action: 'click' as const },
  { selector: '[id*="cookie"] button[class*="accept" i]', action: 'click' as const },
  { selector: '[class*="cookie"] button[class*="agree" i]', action: 'click' as const },
  { selector: 'button[aria-label*="close" i]:not([aria-label*="menu"])', action: 'click' as const },
  { selector: 'button[aria-label*="dismiss" i]', action: 'click' as const },
  { selector: '[class*="overlay"] button[class*="close" i]', action: 'click' as const },
  { selector: '[class*="modal"] button[class*="close" i]', action: 'click' as const },
  { selector: '[class*="popup"] button[class*="close" i]', action: 'click' as const },
];

export const CAPTURE_DEBOUNCE_MS = 500;
export const HEARTBEAT_INTERVAL_MS = 3000;
