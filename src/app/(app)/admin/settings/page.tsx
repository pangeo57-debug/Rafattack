import { requireAdmin } from "@/lib/session";
import { getCommissionPercent } from "@/lib/commission";
import CommissionSettingForm from "@/components/CommissionSettingForm";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const commissionPercent = await getCommissionPercent();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Platform settings</h1>
      <div className="mt-6">
        <CommissionSettingForm current={commissionPercent} />
      </div>
    </div>
  );
}
