import { Check, CreditCard, FileText, PackageCheck, Truck, XCircle } from "lucide-react";

const STEPS = [
  { key: "AWAITING_PAYMENT", label: "Order placed", icon: FileText },
  { key: "PAID", label: "Paid (escrow)", icon: CreditCard },
  { key: "FULFILLED", label: "Shipped / picked up", icon: Truck },
  { key: "COMPLETED", label: "Completed", icon: PackageCheck },
];

function stepIndexFor(status: string) {
  switch (status) {
    case "AWAITING_PAYMENT":
      return 0;
    case "PAID":
      return 1;
    case "SHIPPED":
    case "PICKED_UP":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return -1;
  }
}

export default function OrderStepper({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
        <XCircle className="h-4 w-4" />
        This order was cancelled.
      </div>
    );
  }

  const currentIndex = status === "DISPUTED" ? -1 : stepIndexFor(status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = currentIndex > i || (currentIndex === -1 && i === 0);
        const current = currentIndex === i;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  done
                    ? "border-brand bg-brand text-white"
                    : current
                      ? "border-brand bg-white text-brand"
                      : "border-zinc-200 bg-white text-zinc-300"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={`hidden text-center text-xs font-medium sm:block ${
                  done || current ? "text-zinc-700" : "text-zinc-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 transition-colors ${done ? "bg-brand" : "bg-zinc-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
