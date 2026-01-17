/**
 * ImportModal Component Tests
 * Tests for case import modal with file upload and preview.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportModal } from "../ImportModal";

describe("ImportModal", () => {
  const mockOnImport = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("modal visibility", () => {
    it("renders when open is true", () => {
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      expect(screen.getByText("Import Cases")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      const { container } = render(
        <ImportModal open={false} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      // Dialog content should not be visible
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe("file upload", () => {
    it("displays dropzone for file selection", () => {
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument();
    });

    it("accepts only .json files", () => {
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const input = screen.getByLabelText(/select file/i);
      expect(input).toHaveAttribute("accept", ".json");
    });

    it("parses and previews valid JSON file", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const validJSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          caseStatus: "pwd",
        },
      ]);

      const file = new File([validJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("Tech Corp")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
    });

    it("shows beneficiary warning for cases missing beneficiaryIdentifier", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const jsonWithMissingBeneficiary = JSON.stringify([
        {
          employerName: "Tech Corp",
          // Missing beneficiaryIdentifier - will show warning, not error
        },
      ]);

      const file = new File([jsonWithMissingBeneficiary], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      // Missing beneficiaryIdentifier produces a warning banner, not an error
      // Cases get a placeholder and need manual updates after import
      await waitFor(() => {
        expect(screen.getByText(/Need.*Foreign Worker Info/i)).toBeInTheDocument();
      });
    });
  });

  describe("preview table", () => {
    it("shows preview table with parsed cases", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const validJSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          caseStatus: "pwd",
          progressStatus: "working",
        },
        {
          employerName: "Finance Inc",
          beneficiaryIdentifier: "Jane Smith",
          caseStatus: "recruitment",
        },
      ]);

      const file = new File([validJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        // Check table headers
        expect(screen.getByText("Employer")).toBeInTheDocument();
        expect(screen.getByText("Foreign Worker")).toBeInTheDocument();

        // Check data rows
        expect(screen.getByText("Tech Corp")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Finance Inc")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });
    });

    it("highlights error rows in red", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const mixedJSON = JSON.stringify([
        {
          employerName: "Valid Corp",
          beneficiaryIdentifier: "Valid Person",
        },
        {
          employerName: "Invalid Corp",
          // Missing beneficiaryIdentifier
        },
      ]);

      const file = new File([mixedJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        // Find the error row
        const errorRows = screen.getAllByRole("row").filter((row) => {
          return row.className.includes("bg-red") || row.className.includes("border-red");
        });

        expect(errorRows.length).toBeGreaterThan(0);
      });
    });

    it("shows summary of cases and errors", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const mixedJSON = JSON.stringify([
        {
          employerName: "Valid 1",
          beneficiaryIdentifier: "Person 1",
        },
        {
          employerName: "Valid 2",
          beneficiaryIdentifier: "Person 2",
        },
        {
          employerName: "Invalid",
          // Missing beneficiaryIdentifier
        },
      ]);

      const file = new File([mixedJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/2.*ready.*import/i)).toBeInTheDocument();
        expect(screen.getByText(/1.*error/i)).toBeInTheDocument();
      });
    });
  });

  describe("legacy format warning", () => {
    it("shows warning when legacy format detected", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const legacyJSON = JSON.stringify([
        {
          employer_name: "Tech Corp",
          beneficiary_name: "John Doe",
        },
      ]);

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/legacy.*format/i)).toBeInTheDocument();
      });
    });
  });

  describe("import action", () => {
    it("shows warning but allows import when beneficiaryIdentifier is missing", async () => {
      // Missing beneficiaryIdentifier now produces a warning, not an error
      // Cases get a placeholder and need manual updates after import
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const jsonWithMissingBeneficiary = JSON.stringify([
        {
          employerName: "Corp With Missing Beneficiary",
          // Missing beneficiaryIdentifier - will show warning, not error
        },
      ]);

      const file = new File([jsonWithMissingBeneficiary], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      // Import button should still be enabled (warning doesn't block import)
      await waitFor(() => {
        const importButton = screen.getByRole("button", { name: /import/i });
        // Warning cases are still importable - they get a placeholder beneficiary
        expect(importButton).not.toBeDisabled();
      });

      // But a warning banner should be shown
      await waitFor(() => {
        expect(screen.getByText(/Need.*Foreign Worker Info/i)).toBeInTheDocument();
      });
    });

    it("enables import button when no errors", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const validJSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
        },
      ]);

      const file = new File([validJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        const importButton = screen.getByRole("button", { name: /import/i });
        expect(importButton).not.toBeDisabled();
      });
    });

    it("calls onImport with valid cases when Import clicked", async () => {
      const user = userEvent.setup();
      mockOnImport.mockResolvedValue(undefined);

      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const validJSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
        },
      ]);

      const file = new File([validJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      await waitFor(() => {
        const importButton = screen.getByRole("button", { name: /import/i });
        expect(importButton).not.toBeDisabled();
      });

      const importButton = screen.getByRole("button", { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledTimes(1);
        expect(mockOnImport).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              employerName: "Tech Corp",
              beneficiaryIdentifier: "John Doe",
            }),
          ]),
          {} // empty resolutions object when no duplicates detected
        );
      });
    });

    it("shows loading state during import", async () => {
      const user = userEvent.setup();
      let resolveImport: () => void;
      mockOnImport.mockReturnValue(
        new Promise((resolve) => {
          resolveImport = resolve as () => void;
        })
      );

      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const validJSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
        },
      ]);

      const file = new File([validJSON], "test.json", { type: "application/json" });
      const input = screen.getByLabelText(/select file/i);

      await user.upload(input, file);

      const importButton = screen.getByRole("button", { name: /import/i });
      await user.click(importButton);

      // Should show loading state
      expect(screen.getByRole("button", { name: /importing/i })).toBeDisabled();

      // Resolve import
      resolveImport!();
    });
  });

  describe("cancel action", () => {
    it("calls onOpenChange(false) when Cancel clicked", async () => {
      const user = userEvent.setup();
      render(
        <ImportModal open={true} onOpenChange={mockOnOpenChange} onImport={mockOnImport} />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
