import {
  COUPON_STATUS_LABELS,
  effectiveCouponStatus,
  formatCouponCode,
  listMyCoupons,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cancelCouponAction } from "@/app/actions/offers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus cupons — Gearhead" };

const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function MyCouponsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/ofertas" className="text-sm text-muted hover:underline">
        ← Ofertas
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Meus cupons</h1>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Coupons />
      </Suspense>
    </main>
  );
}

async function Coupons() {
  const user = await requireUser();
  const coupons = await listMyCoupons(await createClient(), user.id);
  if (coupons.length === 0) return <p className="text-muted">Você ainda não pegou cupons.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {coupons.map((c) => {
        const status = effectiveCouponStatus(c);
        return (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
          >
            <div>
              <p className="font-semibold">
                {c.offer?.discount_label} · {c.offer?.title}
              </p>
              <p className="text-sm text-muted">
                {c.offer?.business?.name} · {COUPON_STATUS_LABELS[status]}
                {status === "issued" && ` até ${dateBR(c.expires_at)}`}
                {status === "redeemed" && c.redeemed_at && ` em ${dateBR(c.redeemed_at)}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-lg font-bold tracking-widest ${status === "issued" ? "" : "text-muted line-through"}`}
              >
                {formatCouponCode(c.code)}
              </span>
              {status === "issued" && (
                <form action={cancelCouponAction.bind(null, c.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Desistir
                  </button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
