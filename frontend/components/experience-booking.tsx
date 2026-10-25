"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Users } from "lucide-react";

import { dateInput, toman } from "@/lib/format";

export function ExperienceBookingWidget({
  experienceId,
  price,
  maxParticipants,
}: {
  experienceId: string;
  price: number;
  maxParticipants: number;
}) {
  const [travelDate, setTravelDate] = useState(dateInput(3));
  const [guests, setGuests] = useState(2);

  return (
    <div className="card p-5">
      <div className="text-xs text-ink/45">قیمت هر نفر</div>
      <div className="mt-1 text-2xl font-black text-brand-800">{toman(price)}</div>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="label flex items-center gap-1"><CalendarDays className="h-3 w-3" /> تاریخ تجربه</span>
          <input
            type="date"
            className="input"
            value={travelDate}
            min={dateInput()}
            onChange={(event) => setTravelDate(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label flex items-center gap-1"><Users className="h-3 w-3" /> تعداد نفرات</span>
          <select className="input" value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
            {Array.from({ length: Math.min(10, maxParticipants) }).map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Intl.NumberFormat("fa-IR").format(index + 1)} نفر
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-brand-50/70 px-3 py-2.5 text-xs text-brand-900">
        <span>جمع تقریبی</span>
        <b>{toman(price * guests)}</b>
      </div>
      <Link
        href={`/booking?type=experience&experience=${experienceId}&date=${travelDate}&guests=${guests}`}
        className="btn-primary mt-4 w-full"
      >
        رزرو این تجربه
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-center text-[10px] leading-5 text-ink/40">
        رزرو آنی · لغو رایگان تا ۲۴ ساعت قبل · راهنمای فارسی
      </p>
    </div>
  );
}
