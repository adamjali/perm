import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react/ssr";
import { buttonVariants } from "@/components/ui/button";

/** The dashboard's main action: start a new case. */
export default function AddCaseButton() {
  return (
    <Link href="/cases/new" className={buttonVariants({ size: "lg" })}>
      <PlusIcon aria-hidden="true" />
      Add case
    </Link>
  );
}
