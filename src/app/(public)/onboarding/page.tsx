import { requireUser } from "@/lib/session";

export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold text-zinc-900">No business linked to this account</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This shouldn&apos;t normally happen &mdash; every signup creates a business.
        Please contact support to link your account to a business.
      </p>
    </div>
  );
}
