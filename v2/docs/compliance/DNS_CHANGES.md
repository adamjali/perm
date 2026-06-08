# DNS Changes Required

These DNS records should be added manually via the **Google Cloud DNS** console.

**DNS Zone:** `permtracker.app` (Google Cloud DNS)

---

## 1. DMARC Record (Email Spoofing Prevention)

Prevents attackers from sending emails that appear to come from `@permtracker.app`.

**Record:**
- **Type:** TXT
- **Host:** `_dmarc.permtracker.app`
- **Value:** `v=DMARC1; p=reject; rua=mailto:dmarc@permtracker.app; pct=100`
- **TTL:** 3600

**Steps:**
1. Go to [Google Cloud DNS](https://console.cloud.google.com/net-services/dns/zones)
2. Select the `permtracker.app` zone
3. Click **Add Standard** (or **Add Record Set**)
4. DNS name: `_dmarc`
5. Resource record type: `TXT`
6. TTL: `3600`
7. TXT data: `v=DMARC1; p=reject; rua=mailto:dmarc@permtracker.app; pct=100`
8. Click **Create**

**Verify:**
```bash
dig TXT _dmarc.permtracker.app +short
```

Expected: `"v=DMARC1; p=reject; rua=mailto:dmarc@permtracker.app; pct=100"`

---

## 2. SPF Hardfail (Update Existing Record)

Changes from softfail (`~all`) to hardfail (`-all`) so unauthorized senders are rejected, not just marked.

**Current record:** `v=spf1 include:amazonses.com ~all`
**New record:** `v=spf1 include:amazonses.com -all`

**Steps:**
1. In the `permtracker.app` DNS zone, find the existing TXT record with the SPF value
2. Click **Edit** on that record
3. Change `~all` to `-all`
4. Click **Save**

**Verify:**
```bash
dig TXT permtracker.app +short
```

Look for the SPF record — it should end with `-all` (not `~all`).

---

## 3. CAA Record (Certificate Authority Authorization)

Restricts which certificate authorities can issue SSL certificates for this domain. Only Let's Encrypt (used by Vercel) should be authorized.

**Record:**
- **Type:** CAA
- **Host:** `permtracker.app` (root)
- **Value:** `0 issue "letsencrypt.org"`
- **TTL:** 3600

**Steps:**
1. In the `permtracker.app` DNS zone, click **Add Standard**
2. DNS name: (leave empty for root, or enter `permtracker.app`)
3. Resource record type: `CAA`
4. TTL: `3600`
5. Flag: `0`
6. Tag: `issue`
7. Value: `letsencrypt.org`
8. Click **Create**

**Verify:**
```bash
dig CAA permtracker.app +short
```

Expected: `0 issue "letsencrypt.org"`

---

## Verification Checklist

After making all changes, verify with these commands:

```bash
# DMARC
dig TXT _dmarc.permtracker.app +short
# Expected: "v=DMARC1; p=reject; rua=mailto:dmarc@permtracker.app; pct=100"

# SPF
dig TXT permtracker.app +short
# Look for: "v=spf1 include:amazonses.com -all"

# CAA
dig CAA permtracker.app +short
# Expected: 0 issue "letsencrypt.org"
```

DNS propagation may take up to 24 hours, though Google Cloud DNS typically propagates within minutes.
