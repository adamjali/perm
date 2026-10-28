import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BulletinStation, type BulletinLine } from "../BulletinStation";

const line = (category: string, country: BulletinLine["country"], finalAction: string, datesForFiling: string | null): BulletinLine => ({
  category,
  country,
  finalAction,
  cutoffIso: null,
  datesForFiling,
  status: null,
  shift: null,
});
const LINES: BulletinLine[] = [
  line("EB2", "worldwide", "Apr 1, 2025", "Mar 15, 2026"),
  line("EB2", "india", "Nov 1, 2013", "Jan 15, 2014"),
  line("EB3", "worldwide", "Jun 15, 2024", null),
  line("EB3", "india", "Jan 22, 2014", "Feb 1, 2015"),
];
const renderStation = () => render(<ul><BulletinStation step={4} lines={LINES} bulletinMonth="2026-11" monthLabel="November 2026" /></ul>);

describe("BulletinStation", () => {
  it("opens on EB-2 rest of world, with its dates-for-filing cutoff", () => {
    // Act
    renderStation();
    // Assert
    expect(screen.getByText("Apr 1, 2025")).toBeInTheDocument();
    expect(screen.getByText("Mar 15, 2026")).toBeInTheDocument();
  });

  it("shows the reader's own line when they pick a category and a country", () => {
    // Arrange
    renderStation();
    // Act
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "EB3" } });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "india" } });
    // Assert
    expect(screen.getByText("Jan 22, 2014")).toBeInTheDocument();
    expect(screen.getByText(/EB-3, India: current if filed before/)).toBeInTheDocument();
  });

  it("says a line the filing chart leaves out isn't listed", () => {
    // Arrange
    renderStation();
    // Act
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "EB3" } });
    // Assert
    expect(screen.getByText("not listed")).toBeInTheDocument();
  });
});
