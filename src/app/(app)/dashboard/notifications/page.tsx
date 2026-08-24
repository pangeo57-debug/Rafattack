import Link from "next/link";
import { requireBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ui, formatDate } from "@/lib/ui";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export default async function NotificationsPage() {
  const { business } = await requireBusiness();
  const notifications = await prisma.notification.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Notifications</h1>
        <MarkAllReadButton />
      </div>

      <div className="mt-6 space-y-2">
        {notifications.length === 0 && <p className="text-zinc-500">No notifications yet.</p>}
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.link ?? "#"}
            className={`${ui.card} block p-4 ${n.isRead ? "" : "border-brand/40 bg-brand-soft/40"}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-zinc-900">{n.title}</p>
              <p className="text-xs text-zinc-400">{formatDate(n.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
