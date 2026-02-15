import AuthHeader from "@/components/layout/AuthHeader";
import AuthFooter from "@/components/layout/AuthFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-y-auto">
      {/* Fixed dot pattern background - matches other layouts */}
      <div
        className="bg-dots pointer-events-none fixed inset-0 opacity-30"
        aria-hidden="true"
      />

      {/* Header spacer - reserves space for fixed header */}
      <div className="relative z-20 flex-shrink-0 h-20">
        <AuthHeader />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 sm:py-12 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <div className="relative z-20 flex-shrink-0">
        <AuthFooter />
      </div>
    </div>
  );
}
