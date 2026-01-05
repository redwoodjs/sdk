# Security Policy

## Overview

RedwoodSDK aims to provide a secure-by-default foundation where possible.  
However, application security ultimately remains the responsibility of application authors and operators.

This document outlines how we handle security reports, what is in scope, and what users should expect.

---

## Reporting a Vulnerability

If you believe you have found a security vulnerability in RedwoodSDK, **please report it privately**.

Private reporting helps prevent unpatched vulnerabilities from being exploited before a fix is available.

- **Do not** open a public GitHub issue for suspected security vulnerabilities.
- Instead, report the issue using **GitHub Security Advisories** for this repository  
  (via the “Report a vulnerability” button under the repository's *Security* tab).

When reporting, please include:
- A description of the issue
- A minimal reproduction, if possible
- Affected versions
- Any relevant logs or error messages

We will respond as reasonably as possible, but do not guarantee specific response or resolution timelines.

---

## Coordinated Disclosure

We follow a coordinated disclosure process:

- Security reports are handled privately.
- If a report is accepted, we will work on a fix before any public disclosure.
- A public security advisory **may** be published after a fix is released, at the maintainers' discretion.

---

## Supported Versions

RedwoodSDK is currently in **beta** (`1.0.0-beta.x`).

Security fixes are provided only for the **latest beta release**.

Beta releases may include breaking changes, and fixes are not guaranteed to be backported to earlier beta versions.

Once RedwoodSDK reaches a stable 1.0 release, this policy may be updated to reflect supported stable versions.

---

## Scope

### In Scope

Security issues affecting:
- RedwoodSDK core packages
- Official starters and templates
- Addons and infrastructure provided by RedwoodSDK

Including vulnerabilities that:
- Allow unintended access
- Enable privilege escalation
- Expose sensitive data due to framework behaviour

### Out of Scope

- User application code
- Deployment or infrastructure misconfiguration
- Environment variable or secret management errors
- Third-party dependencies, unless directly caused by RedwoodSDK integration code
- Denial-of-service attacks, social engineering, or phishing

---

## Secure-by-Default Principles

Where possible, RedwoodSDK aims to:
- Prefer secure defaults over optional configuration
- Require explicit opt-in for dangerous or insecure behaviour
- Avoid silent fallbacks that weaken security
- Rely on platform-native security primitives where available

---

## Disclaimer

RedwoodSDK is provided **as-is**.

We make no guarantees that the framework is free of vulnerabilities, and we are not responsible for the security of applications built with it.