/**
 * UI Components Index
 * Central export point for all UI components
 *
 * Phase: 17-20
 * Created: 2025-12-23
 */

// Core UI Components (shadcn/ui based)
export { Badge, badgeVariants } from "./badge";
export { Button, buttonVariants } from "./button";
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./card";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export { Divider } from "./divider";
export { Input } from "./input";
export { Label } from "./label";
export { Skeleton } from "./skeleton";
export { Spinner } from "./spinner";
export { Toaster } from "./sonner";

// New Components (Phase 20)
export { default as HazardStripes } from "./hazard-stripes";
export { default as CornerLabel } from "./corner-label";
export { default as ProgressRing } from "./progress-ring";
