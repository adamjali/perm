# Phase 7: Frontend Security - Research

**Researched:** 2025-12-19
**Domain:** XSS prevention, DOMPurify, Content Security Policy
**Confidence:** HIGH

<research_summary>
## Summary

Researched XSS remediation strategies for a vanilla HTML/CSS/JS frontend hosted on Vercel with Alpine.js and Tailwind CSS CDN. The standard approach is DOMPurify for HTML sanitization combined with Content Security Policy (CSP) headers for defense-in-depth.

Key finding: The codebase has **95 unsafe DOM assignments** across 17 files (primarily in HTML templates and UI utility modules). DOMPurify should wrap all user-controlled content before DOM insertion. CSP provides browser-level enforcement but requires hash-based implementation for static sites (Vercel cannot generate per-request nonces).

Trusted Types API is production-ready in Chrome/Edge/Safari (82% coverage) but not Firefox - recommend as future enhancement, not Phase 7 requirement.

**Primary recommendation:** Install DOMPurify via CDN, create a centralized `sanitize.js` utility, systematically wrap all DOM assignments handling user/API data, then add CSP headers in report-only mode before enforcing.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| DOMPurify | 3.2.2 | HTML sanitization | Industry standard XSS sanitizer, 88.5 benchmark score, maintained by cure53 security researchers |
| CSP Headers | N/A | Browser enforcement | Defense-in-depth, blocks inline scripts without explicit allowlisting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Alpine.js CSP Build | 3.x | XSS-safe Alpine | Required if using CSP - standard Alpine uses dynamic code execution |
| Trusted Types API | Native | DOM sink enforcement | Future enhancement (82% browser support, no Firefox) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOMPurify | sanitize-html | DOMPurify is faster, browser-native, lighter (8KB vs 200KB+ for sanitize-html) |
| DOMPurify | Manual escaping | Error-prone, easy to miss edge cases - don't hand-roll |
| Hash-based CSP | Nonce-based CSP | Nonces require server-side generation - impossible for static Vercel sites |

**Installation:**
```html
<!-- DOMPurify via CDN (recommended for this project) -->
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.2.2/dist/purify.min.js"></script>

<!-- Or via npm if bundling -->
npm install dompurify
```

**Alpine.js CSP Build (if adding CSP):**
```html
<!-- Replace standard Alpine with CSP build -->
<script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/[email protected]/dist/cdn.min.js"></script>
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── src/js/
│   ├── utils/
│   │   └── sanitize.js      # NEW: Centralized DOMPurify wrapper
│   └── ...
├── public/js/
│   └── ...                  # Chatbot modules (already modularized)
└── vercel.json              # ADD: CSP headers configuration
```

### Pattern 1: Centralized Sanitization Utility
**What:** Single module wrapping DOMPurify with project-specific configuration
**When to use:** Always - every DOM assignment with user/API data
**Example:**
```javascript
// src/js/utils/sanitize.js
// Source: DOMPurify official docs + OWASP guidelines

/**
 * Centralized HTML sanitization utility.
 * Wraps DOMPurify with project-specific configuration.
 */
const Sanitizer = {
  /**
   * Sanitize HTML string for safe DOM insertion.
   * @param {string} dirty - Untrusted HTML string
   * @returns {string} - Sanitized HTML safe for DOM insertion
   */
  html(dirty) {
    if (typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
    });
  },

  /**
   * Sanitize for text-only contexts (strips all HTML).
   */
  text(dirty) {
    if (typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
  },

  /**
   * Sanitize user-generated rich content (more permissive).
   */
  richContent(dirty) {
    if (typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
  }
};

window.Sanitizer = Sanitizer;
```

### Pattern 2: Safe DOM Assignment
**What:** Replace raw DOM assignments with sanitized version
**When to use:** Any DOM assignment with dynamic content
**Example:**
```javascript
// BEFORE (vulnerable)
element.property = userProvidedHtml;  // where property is innerHTML

// AFTER (safe)
element.property = Sanitizer.html(userProvidedHtml);

// For plain text display (safest)
element.textContent = Sanitizer.text(userInput);
```

### Pattern 3: Safe Link Construction
**What:** Sanitize href attributes, add rel="noopener"
**When to use:** Any dynamically created links
**Example:**
```javascript
// Source: OWASP DOM XSS Prevention Cheat Sheet
const link = document.createElement('a');
link.href = encodeURI(userUrl);
link.textContent = Sanitizer.text(linkText);
link.setAttribute('target', '_blank');
link.setAttribute('rel', 'noopener noreferrer');
parent.appendChild(link);
```

### Pattern 4: DOMPurify Hook for Links
**What:** Automatically add security attributes to all links
**When to use:** Global configuration in sanitize.js
**Example:**
```javascript
// Source: DOMPurify demos/hooks-target-blank-demo.html
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (!node.hasAttribute('target') && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
```

### Anti-Patterns to Avoid
- **Using DOM insertion with unsanitized API responses:** Always sanitize, even trusted APIs
- **Creating sanitize wrappers per file:** Use centralized Sanitizer module
- **Allowing style attributes in user content:** Can enable CSS-based attacks
- **Using dynamic code execution with user data:** Never - no sanitization can make this safe
- **Trusting data just because it's from your own backend:** Defense-in-depth requires sanitization everywhere
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML sanitization | Regex-based stripping, allowlist filters | DOMPurify | HTML parsing is complex; bypass vectors exist for regex |
| HTML entity encoding | Manual replacement | DOMPurify or textContent | Easy to miss entities; context-dependent encoding needed |
| URL validation | Simple string checks | URL constructor + encodeURI | Protocol attacks (javascript:), unicode normalization issues |
| CSP generation | Manual header string building | Structured vercel.json config | Typos break security |
| XSS detection | Pattern matching | DOMPurify + CSP | Attackers are more creative than your patterns |

**Key insight:** XSS prevention has 20+ years of attack evolution. DOMPurify is maintained by cure53 security researchers who actively track new bypass techniques.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Sanitizing After DOM Insertion
**What goes wrong:** HTML parsed and executed before sanitization runs
**Why it happens:** Misunderstanding execution order
**How to avoid:** Always sanitize BEFORE assignment
**Warning signs:** XSS works despite having sanitization code

### Pitfall 2: Forgetting textContent Alternative
**What goes wrong:** Using HTML insertion when text display is all that's needed
**Why it happens:** Habit, not thinking about context
**How to avoid:** Default to textContent; only use HTML insertion when rendering is required
**Warning signs:** Using HTML insertion for usernames, labels, single-line content

### Pitfall 3: Over-Permissive Sanitization Config
**What goes wrong:** Allowing script, style, or event handlers "for flexibility"
**Why it happens:** Making things "work" without understanding risk
**How to avoid:** Start restrictive, only add allowed tags/attrs when explicitly needed
**Warning signs:** Config allows 'script', 'style', or 'on*' attributes

### Pitfall 4: CSP Breaking Alpine.js
**What goes wrong:** Alpine.js stops working after adding CSP
**Why it happens:** Standard Alpine uses dynamic code execution internally
**How to avoid:** Use Alpine CSP build: @alpinejs/csp
**Warning signs:** Console errors about "unsafe-eval" violations

### Pitfall 5: Missing CSP on API Error Messages
**What goes wrong:** Error messages from API rendered unsanitized
**Why it happens:** Assuming error messages are "safe" system text
**How to avoid:** Sanitize ALL external data, including error responses
**Warning signs:** Error messages contain HTML that renders

### Pitfall 6: Hash Mismatch After Code Changes
**What goes wrong:** CSP blocks scripts after deployment
**Why it happens:** Inline script changed but hash in CSP wasn't updated
**How to avoid:** Automate hash generation in build process, or avoid inline scripts
**Warning signs:** Scripts work locally but break in production
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Basic DOMPurify Usage
```javascript
// Source: DOMPurify README.md
const dirty = '<img src=x onerror=alert(1)//>';
const clean = DOMPurify.sanitize(dirty);
// Result: '<img src="x">'

element.setHTML(clean);  // or use sanitized string with DOM property
```

### Restrictive Configuration for User Content
```javascript
// Source: DOMPurify demos/config-demo.html
const config = {
  ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'br'],
  ALLOWED_ATTR: ['href'],
  KEEP_CONTENT: false
};
const clean = DOMPurify.sanitize(userInput, config);
```

### Safe textContent for Plain Text
```javascript
// Source: OWASP DOM XSS Prevention Cheat Sheet
// This is the SAFEST approach - use when HTML not needed
element.textContent = untrustedData;  // Does not execute code
```

### Safe Element Construction
```javascript
// Source: OWASP DOM XSS Prevention Cheat Sheet
const newElement = document.createElement('div');
newElement.textContent = userInput;  // Safe
newElement.className = 'user-message';
parentElement.appendChild(newElement);
```

### Vercel CSP Configuration
```json
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy-Report-Only",
      "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://perm-tracker-api.onrender.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "X-Frame-Options",
      "value": "DENY"
    },
    {
      "key": "Referrer-Policy",
      "value": "strict-origin-when-cross-origin"
    }
  ]
}
```

### DOMPurify with Global Link Security Hook
```javascript
// Source: DOMPurify demos/hooks-target-blank-demo.html
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ('target' in node) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (!node.hasAttribute('target') && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual HTML escaping | DOMPurify library | 2014+ | Don't escape manually; library handles edge cases |
| Nonce-based CSP everywhere | Hash-based CSP for static sites | Always for static | Vercel static sites can't generate per-request nonces |
| Inline scripts with 'unsafe-inline' | External scripts with hashes | Best practice | Reduces attack surface, enables strict CSP |
| No CSP (just sanitization) | Sanitization + CSP layers | 2020+ | Defense-in-depth is standard |

**New tools/patterns to consider:**
- **Trusted Types API:** Browser-native enforcement (82% support). Consider as Phase 10 enhancement.
- **Alpine CSP Build:** Required if adding CSP to this project.
- **Report-Only CSP:** Deploy in report-only mode first to identify violations before enforcing.

**Deprecated/outdated:**
- **Manual regex sanitization:** Never use; bypass vectors constantly discovered
- **'unsafe-inline' in script-src:** Defeats purpose of CSP; use hashes instead
- **Client-side-only sanitization without CSP:** Single point of failure
</sota_updates>

<open_questions>
## Open Questions

1. **Alpine.js CSP compatibility scope**
   - What we know: Alpine CSP build removes dynamic code execution dependency
   - What's unclear: Exact impact on existing Alpine code patterns in this codebase
   - Recommendation: Audit Alpine usage before switching to CSP build

2. **Test Supabase URL for CSP connect-src**
   - What we know: Test environment uses different Supabase instance
   - What's unclear: All API endpoints that need allowlisting
   - Recommendation: Start with report-only CSP to discover all required connect-src URLs

3. **PWA service worker CSP**
   - What we know: Service workers run in separate context
   - What's unclear: Whether current sw.js needs CSP changes
   - Recommendation: Test service worker functionality after adding CSP
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- /cure53/dompurify via Context7 - configuration, hooks, sanitization patterns
- /owasp/cheatsheetseries via Context7 - DOM XSS prevention, CSP implementation
- Vercel official documentation - CSP header configuration for static sites

### Secondary (MEDIUM confidence)
- WebSearch: "Alpine.js CSP build 2025" - verified against Alpine.js docs
- WebSearch: "Trusted Types browser support 2025" - verified against caniuse.com
- WebSearch: "DOMPurify Trusted Types integration" - verified against DOMPurify README

### Tertiary (LOW confidence - needs validation)
- None - all findings verified against primary sources
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: DOMPurify for HTML sanitization
- Ecosystem: CSP headers, Trusted Types (future), Alpine CSP build
- Patterns: Centralized sanitization, safe DOM manipulation
- Pitfalls: Sanitization timing, CSP breaking Alpine, hash management

**Confidence breakdown:**
- Standard stack: HIGH - DOMPurify is industry standard, verified via Context7
- Architecture: HIGH - Patterns from OWASP and DOMPurify official examples
- Pitfalls: HIGH - Documented in OWASP, verified in DOMPurify issues
- Code examples: HIGH - All from Context7/official sources

**Research date:** 2025-12-19
**Valid until:** 2026-01-19 (30 days - stable domain, DOMPurify actively maintained)
</metadata>

---

*Phase: 07-frontend-security*
*Research completed: 2025-12-19*
*Ready for planning: yes*
