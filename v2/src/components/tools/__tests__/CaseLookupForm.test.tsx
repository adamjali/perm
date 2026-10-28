import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LangProvider } from "@/components/i18n/LangProvider";
import { CaseLookupForm } from "../CaseLookupForm";

describe("CaseLookupForm", () => {
  it("submits the number to the case page as a plain GET", () => {
    const { container } = render(<CaseLookupForm />);
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/perm-case-status");
  });

  it("offers the employer search to someone without the number", () => {
    render(<CaseLookupForm />);
    const link = screen.getByRole("link", { name: /find a case by employer name/i });
    expect(link.getAttribute("href")).toBe("/case-search");
  });
});

describe("CaseLookupForm in another language", () => {
  it("submits to the translated case page and speaks the reader's language", () => {
    const { container } = render(
      <LangProvider lang="es">
        <CaseLookupForm />
      </LangProvider>,
    );
    expect(container.querySelector("form")?.getAttribute("action")).toBe("/es/perm-case-status");
    expect(screen.getByRole("button", { name: "Consultar" })).toBeTruthy();
    expect(screen.getByLabelText("Su número de caso PERM")).toBeTruthy();
    // The employer search is English only, and the link says so.
    expect(screen.getByRole("link", { name: /\(en inglés\)/ }).getAttribute("href")).toBe("/case-search");
  });

  it("warns about a USCIS receipt in the reader's language", () => {
    render(
      <LangProvider lang="zh">
        <CaseLookupForm />
      </LangProvider>,
    );
    fireEvent.change(screen.getByLabelText("您的 PERM 案件编号"), { target: { value: "EAC2190123456" } });
    expect(screen.getByText(/移民局（USCIS）的收据编号/)).toBeTruthy();
  });

  it("lets a page's own words win (the guides and the embed pass theirs)", () => {
    render(
      <LangProvider lang="es">
        <CaseLookupForm buttonLabel="Buscar" label="Número" />
      </LangProvider>,
    );
    expect(screen.getByRole("button", { name: "Buscar" })).toBeTruthy();
    expect(screen.getByLabelText("Número")).toBeTruthy();
  });
});
