# ADR 0001: Blocking addresses from the mailing list

**Date:** 2026-11-02
**Status:** Accepted

## Context

A signup came in from maxxspace.com, a disposable ("burner") email domain. We don't want throwaway addresses on the list: they inflate the count, hurt sender reputation when they bounce, and are often abuse. Blocked addresses must never be emailed (not even the confirmation), must show in the admin app with a reason we can edit (e.g. `BURNER-EMAIL`), and once blocked no automated path may put them back on the list. The list lives in D1 (`ravenburst-list`); signups go through Pages Functions; scripts and the admin app also write to it.

## Options considered

1. **Reject at signup only, store nothing.** Pros: simplest. Cons: no record in the admin app; nothing stops a script or a later code change from re-adding a blocked address.
2. **A `block_reason` column, checked in each code path.** Pros: visible and editable. Cons: the guarantee is only as good as every current and future query remembering the check.
3. **A `block_reason` column plus database triggers** that refuse any insert or update leaving a blocked row anything but `unsubscribed`. Pros: one rule covers signup, confirm, scripts, the admin app and code not written yet. Cons: a missed check surfaces as a failed write rather than silently working.
4. **A third-party verification API** (disposable/MX/role detection). Pros: broader, maintained. Cons: cost, latency, and every signup's address sent to another company.

For the domain list: a bundled copy of the community `disposable-email-domains` list (CC0, ~10k domains) plus D1 `blocked_domains` (ours, with a reason) and `allowed_domains` (overrides for the bundled list's false positives), versus fetching a list at request time (slow, and fails open or closed when the source is down).

## Decision

Option 3, with the bundled list plus the two D1 tables, because the triggers make "blocked means off the list" true by construction instead of by convention. Lifting a block is a deliberate manual action: clearing `block_reason` in the admin app, behind a confirmation. Even then the address stays unsubscribed until its owner signs up and confirms again.

## Consequences

- Positive: no signup, confirm, script or admin path can re-add a blocked address; blocked signups are kept and tagged, so they're visible; reasons are free text (dropdown + Other in the admin app).
- Positive: domain blocks answer "use a permanent email address" (they only reveal a domain rule); a hand-blocked individual address gets the normal reply, so blocks can't be probed.
- Negative: any new query that updates a blocked row's status fails loudly (`blocked address must stay unsubscribed`). Intended, but it must be handled where it can happen.
- Negative: the bundled list ages. Refresh with `npm run list:update-blocklist` (review the diff, then redeploy); a poisoned upstream list could block real providers until noticed, which `allowed_domains` can undo without a deploy.
- Follow-up: consider an MX lookup (reject domains that can't receive mail) and Cloudflare Turnstile on the form.
