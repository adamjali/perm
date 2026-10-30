import { AppBreadcrumb } from "../../components/AppBreadcrumb";
import { PageHeading } from "../../components/PageHeading";

/**
 * The new-case page's breadcrumb and title. Shared with cases/new/loading.tsx
 * so the loading state shows the real heading: none of it depends on data.
 */
export function NewCaseHeading() {
  return (
    <>
      <AppBreadcrumb steps={[{ href: "/cases", label: "Cases" }]} current="Add new case" />
      <PageHeading
        title="Add new case"
        lede="Enter case details below. Only the employer and the position are required."
      />
    </>
  );
}
