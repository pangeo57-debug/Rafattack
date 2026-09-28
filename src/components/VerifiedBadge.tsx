import { BadgeCheck, ShieldAlert } from "lucide-react";
import { ui } from "@/lib/ui";

export default function VerifiedBadge({ verified, size = "sm" }: { verified: boolean; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return verified ? (
    <span className={`${ui.badge} bg-emerald-50 text-emerald-700 ring-emerald-600/20`}>
      <BadgeCheck className={iconSize} />
      Verified
    </span>
  ) : (
    <span className={`${ui.badge} bg-amber-50 text-amber-700 ring-amber-600/20`}>
      <ShieldAlert className={iconSize} />
      Not verified
    </span>
  );
}
