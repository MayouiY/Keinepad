import { charsetOf, findEncoding, type EncodingGroup, type EncodingInfo } from '../utils/encoding';
import { t, type MessageKey } from '../utils/i18n';

/*
 * MV3 has no API to change how a page is decoded, so the override rewrites the charset of
 * the page's Content-Type response header with a declarativeNetRequest session rule and
 * reloads the tab. The browser then decodes the page natively: scripts, forms and the
 * back/forward history keep working, unlike re-decoding a refetched copy in the page.
 *
 * Rules are scoped to one tab and one host, and only touch top-level documents whose
 * Content-Type already is one of TEXT_TYPES, so images, downloads or JSON opened in the same
 * tab are left alone. Session rules disappear when the browser restarts; the background
 * worker removes them when the tab closes.
 */
const TEXT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

type Rule = chrome.declarativeNetRequest.Rule;

function isTabRule(rule: Rule, tabId: number): boolean {
  return !!rule.condition.tabIds?.includes(tabId);
}

/** The encoding forced on `host` in `tabId`, or undefined when the page is auto-detected. */
export async function getEncodingOverride(tabId: number, host: string): Promise<EncodingInfo | undefined> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const rule = rules.find((r) => isTabRule(r, tabId) && r.condition.requestDomains?.includes(host));
  const value = rule?.action.responseHeaders?.[0]?.value;
  return value ? findEncoding(charsetOf(value)) : undefined;
}

/** Force `encoding` on `host` in `tabId` (undefined restores auto-detection). Does not reload. */
export async function setEncodingOverride(tabId: number, host: string, encoding: string | undefined): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  let nextId = Math.max(0, ...rules.map((r) => r.id)) + 1;
  const addRules: Rule[] = encoding
    ? TEXT_TYPES.map((type) => ({
        id: nextId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          responseHeaders: [
            {
              header: 'content-type',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: `${type}; charset=${encoding}`,
            },
          ],
        },
        condition: {
          tabIds: [tabId],
          requestDomains: [host],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
          responseHeaders: [{ header: 'content-type', values: [type, `${type};*`] }],
        },
      }))
    : [];
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.filter((r) => isTabRule(r, tabId)).map((r) => r.id),
    addRules,
  });
}

/** Apply (or clear) the override and reload so the page is decoded again. */
export async function applyEncoding(tabId: number, host: string, encoding: string | undefined): Promise<void> {
  await setEncodingOverride(tabId, host, encoding);
  // Bypass the cache so the response goes through the header rewrite again.
  await chrome.tabs.reload(tabId, { bypassCache: true });
}

export async function clearTabEncoding(tabId: number): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = rules.filter((r) => isTabRule(r, tabId)).map((r) => r.id);
  if (removeRuleIds.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
}

/** The encoding the page was actually decoded with (`document.characterSet`). */
export async function detectEncoding(tabId: number): Promise<string | undefined> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: () => document.characterSet });
  return res?.result ?? undefined;
}

export function encodingGroupLabel(group: EncodingGroup): string {
  return t(`encGroup${group[0].toUpperCase()}${group.slice(1)}` as MessageKey);
}
