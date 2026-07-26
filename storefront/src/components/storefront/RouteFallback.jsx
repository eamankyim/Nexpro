/**
 * Light Suspense fallback for lazy-loaded storefront routes.
 */
export default function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-white">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent"
        role="status"
        aria-label="Loading page"
      />
    </div>
  );
}
