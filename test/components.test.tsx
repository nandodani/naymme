import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType, type ReactNode } from "react";

import { ProviderRow } from "../components/provider-row.js";
import { ProviderColumn } from "../components/provider-column.js";
import { SearchInput } from "../components/search-input.js";
import { ResultsGrid } from "../components/results-grid.js";
import { OverallCard } from "../components/overall-card.js";
import { CopyToast } from "../components/toast.js";
import { Navbar } from "../components/navbar.js";
import { Hero } from "../components/hero.js";
import { BRAND_ICONS } from "../components/brand-icons.js";
import { RegistrarIcon } from "../components/registrar-icons.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Input } from "../components/ui/input.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";

import { REGISTRARS } from "../lib/links.js";
import { PROVIDER_GROUPS, providerGroup } from "../lib/provider-meta.js";
import type { ProviderMeta } from "../lib/provider-meta.js";
import { demoCheckAvailability } from "../lib/demo.js";
import type { AvailabilityResponse } from "../lib/availability.js";
import type { AvailabilityResult } from "../src/types.js";

/** renderToStaticMarkup — presentational check, no DOM required. */
const html = (node: ReactNode) => renderToStaticMarkup(node);

const meta = (id: string, label: string): ProviderMeta => ({ id: id as ProviderMeta["id"], label });

const result = (
  provider: AvailabilityResult["provider"],
  status: AvailabilityResult["status"],
  subject: string,
): AvailabilityResult => ({
  provider,
  status,
  subject,
  available:
    status === "available" ? true : status === "taken" || status === "invalid" ? false : null,
  durationMs: 10,
});

describe("SearchInput", () => {
  it("renders the input and Search button", () => {
    const markup = html(
      createElement(SearchInput, {
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        valid: true,
      }),
    );
    expect(markup).toContain('aria-label="Name to check"');
    expect(markup).toContain(">Search<");
  });

  it("shows the format hint only for a non-empty invalid value", () => {
    const invalid = html(
      createElement(SearchInput, {
        value: "bad name!",
        onChange: () => {},
        onSubmit: () => {},
        valid: false,
      }),
    );
    expect(invalid).toContain('role="status"');
    const empty = html(
      createElement(SearchInput, {
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        valid: false,
      }),
    );
    expect(empty).not.toContain('role="status"');
    const valid = html(
      createElement(SearchInput, {
        value: "acme",
        onChange: () => {},
        onSubmit: () => {},
        valid: true,
      }),
    );
    expect(valid).not.toContain('role="status"');
  });
});

describe("ProviderRow", () => {
  it("links an available domain to a registrar and shows price chips", () => {
    const markup = html(
      createElement(ProviderRow, {
        meta: meta("domain:com", ".com"),
        name: "acme",
        result: result("domain:com", "available", "acme.com"),
        pending: false,
      }),
    );
    expect(markup).toContain("Register acme.com");
    expect(markup).toContain("~$");
    expect(markup).toContain("acme.com");
  });

  it("shows — for registrars that do not carry the TLD", () => {
    // .io is not carried by Cloudflare in TLD_PRICE_ESTIMATES
    const markup = html(
      createElement(ProviderRow, {
        meta: meta("domain:io", ".io"),
        name: "acme",
        result: result("domain:io", "available", "acme.io"),
        pending: false,
      }),
    );
    expect(markup).toContain("does not carry this TLD");
  });

  it("links a taken domain to the live site without price chips", () => {
    const markup = html(
      createElement(ProviderRow, {
        meta: meta("domain:com", ".com"),
        name: "acme",
        result: result("domain:com", "taken", "acme.com"),
        pending: false,
      }),
    );
    expect(markup).toContain('href="https://acme.com"');
    expect(markup).toContain("Visit acme.com");
    expect(markup).not.toContain("~$");
  });

  it("links an available social handle to its claim URL", () => {
    const markup = html(
      createElement(ProviderRow, {
        meta: meta("social:x", "X"),
        name: "acme",
        result: result("social:x", "available", "@acme"),
        pending: false,
      }),
    );
    expect(markup).toContain("https://x.com/i/flow/signup");
    expect(markup).toContain("Claim @acme on X");
  });

  it("links a taken social handle to its profile", () => {
    const markup = html(
      createElement(ProviderRow, {
        meta: meta("github:user", "GitHub (User)"),
        name: "acme",
        result: result("github:user", "taken", "acme"),
        pending: false,
      }),
    );
    expect(markup).toContain("https://github.com/acme");
  });

  it("renders no link while a check is pending or the status is unknown/invalid", () => {
    for (const status of ["unknown", "invalid"] as const) {
      const markup = html(
        createElement(ProviderRow, {
          meta: meta("npm", "npm"),
          name: "acme",
          result: result("npm", status, "acme"),
          pending: false,
        }),
      );
      expect(markup).not.toContain("<a ");
    }
    const pending = html(
      createElement(ProviderRow, {
        meta: meta("npm", "npm"),
        name: "acme",
        result: undefined,
        pending: true,
      }),
    );
    expect(pending).toContain("checking");
  });
});

describe("ProviderColumn", () => {
  const group = providerGroup("socials");

  it("renders every provider row for its group", () => {
    const markup = html(
      createElement(ProviderColumn, {
        group,
        name: "acme",
        resultsByProvider: new Map(),
        pending: false,
        filter: "all",
      }),
    );
    for (const m of group.providers) expect(markup).toContain(m.label);
  });

  it("the available-only filter hides taken and unknown rows", () => {
    const results = new Map<string, AvailabilityResult>([
      ["social:x", result("social:x", "available", "@acme")],
      ["telegram", result("telegram", "taken", "acme")],
    ]);
    const markup = html(
      createElement(ProviderColumn, {
        group,
        name: "acme",
        resultsByProvider: results,
        pending: false,
        filter: "available",
      }),
    );
    expect(markup).toContain("@acme");
    expect(markup).not.toContain(">acme<");
  });
});

describe("ResultsGrid / OverallCard", () => {
  const data: AvailabilityResponse = {
    ...demoCheckAvailability("acme"),
    mode: "demo",
  };

  it("renders the group sections and filter controls", () => {
    const markup = html(
      createElement(ResultsGrid, {
        name: "acme",
        data,
        checking: false,
        error: null,
        onRetry: () => {},
        onCopy: () => {},
      }),
    );
    for (const g of PROVIDER_GROUPS) {
      expect(markup).toContain(g.title.replaceAll("&", "&amp;"));
    }
    expect(markup).toContain("Available only");
  });

  it("renders the error state with a retry action", () => {
    const markup = html(
      createElement(ResultsGrid, {
        name: "acme",
        data: null,
        checking: false,
        error: "boom",
        onRetry: () => {},
        onCopy: () => {},
      }),
    );
    expect(markup).toContain("boom");
  });

  it("OverallCard renders a percentage once checks settle", () => {
    const markup = html(
      createElement(OverallCard, {
        availability: data,
        checking: false,
        name: "acme",
        onCopy: () => {},
      }),
    );
    expect(markup).toMatch(/\d+%/);
  });

  it("OverallCard shows a skeleton while checking", () => {
    const markup = html(
      createElement(OverallCard, {
        availability: null,
        checking: true,
        name: "acme",
        onCopy: () => {},
      }),
    );
    expect(markup).not.toMatch(/\d+%/);
  });
});

describe("chrome", () => {
  it("CopyToast renders the message and nothing when null", () => {
    expect(html(createElement(CopyToast, { message: "Copied" }))).toContain("Copied");
    expect(html(createElement(CopyToast, { message: null }))).not.toContain("Copied");
  });

  it("Navbar renders the connect action", () => {
    const markup = html(createElement(Navbar, { onCopy: () => {} }));
    expect(markup.length).toBeGreaterThan(0);
  });

  it("Hero renders the hero-variant search control", () => {
    const markup = html(
      createElement(Hero, {
        value: "acme",
        onChange: () => {},
        onSubmit: () => {},
        valid: true,
        inputRef: { current: null },
      }),
    );
    expect(markup).toContain('aria-label="Name to check"');
  });
});

describe("icons", () => {
  it("every brand icon renders an svg", () => {
    for (const [name, Icon] of Object.entries(BRAND_ICONS)) {
      const markup = html(createElement(Icon as ComponentType));
      expect(markup, name).toContain("<svg");
    }
  });

  it("every registrar icon renders an svg or stroke glyph", () => {
    for (const r of REGISTRARS) {
      const markup = html(createElement(RegistrarIcon, { id: r.id }));
      expect(markup, r.id).toContain("<svg");
    }
  });
});

describe("ui primitives", () => {
  it("Button renders variants", () => {
    expect(html(createElement(Button, null, "Go"))).toContain(">Go<");
    expect(html(createElement(Button, { variant: "outline" }, "Go"))).toContain(">Go<");
  });

  it("Badge renders variants", () => {
    expect(html(createElement(Badge, null, "tag"))).toContain("tag");
  });

  it("Input, Skeleton and Card render", () => {
    expect(html(createElement(Input, { placeholder: "x" }))).toContain('placeholder="x"');
    expect(html(createElement(Skeleton, { className: "h-4" }))).toContain("h-4");
    const card = html(
      createElement(
        Card,
        null,
        createElement(CardHeader, null, createElement(CardTitle, null, "T")),
        createElement(CardContent, null, "body"),
      ),
    );
    expect(card).toContain(">T<");
    expect(card).toContain("body");
  });
});
