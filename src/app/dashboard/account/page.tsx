import { requireBusiness } from "@/lib/session";
import { ui } from "@/lib/ui";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export default async function AccountSettingsPage() {
  const { user, business } = await requireBusiness();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Account</h1>

      <div className={`${ui.card} mt-6 p-4`}>
        <p className="text-sm text-slate-500">Signed in as</p>
        <p className="mt-1 font-medium text-slate-900">{user.email}</p>
        <p className="text-sm text-slate-500">{business.name}</p>
      </div>

      <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-900">Danger zone</p>
        <p className="mt-1 text-sm text-red-800">
          Deleting your account closes your business profile, removes your active
          listings, and signs you out everywhere. It can&apos;t be undone. Orders in
          progress must be completed or cancelled first.
        </p>
        <div className="mt-4">
          <DeleteAccountButton businessName={business.name} />
        </div>
      </div>
    </div>
  );
}
