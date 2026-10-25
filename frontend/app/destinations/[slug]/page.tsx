import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";

import { DestinationTabs } from "@/components/destination-tabs";
import { Badge, SmartImage } from "@/components/ui";
import { serverFetch } from "@/lib/api";
import type {
  Attraction,
  Destination,
  Experience,
  MapData,
  Page,
  Restaurant,
  Review,
} from "@/lib/types";
import { destinationName } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface HotelSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  image_url?: string | null;
  images: string[];
  short_description: string;
  guest_rating: number;
  star_rating: number;
  review_count: number;
  base_price: number;
  amenities: string[];
  distance_to_center_km: number;
  is_featured: boolean;
}

interface Weather {
  temperature_c: number;
  feels_like_c: number;
  condition: string;
  humidity: number;
  wind_kph: number;
  forecast: { date: string; temp_min: number; temp_max: number; condition: string }[];
}

async function loadDestination(slug: string) {
  const destination = await serverFetch<Destination>(`/destinations/${slug}`);
  if (!destination) return null;

  const [attractions, hotels, experiences, restaurants, map, weather, reviews] =
    await Promise.all([
      serverFetch<Page<Attraction>>(`/destinations/${slug}/attractions`, { page_size: 50 }),
      serverFetch<Page<HotelSummary>>(`/destinations/${slug}/accommodations`, { page_size: 20 }),
      serverFetch<Page<Experience>>(`/destinations/${slug}/experiences`, { page_size: 20 }),
      serverFetch<Page<Restaurant>>(`/destinations/${slug}/restaurants`, { page_size: 30 }),
      serverFetch<MapData>(`/destinations/${slug}/map`),
      serverFetch<Weather>(`/destinations/${slug}/weather`),
      serverFetch<Page<Review>>("/reviews", {
        entity_type: "destination",
        entity_id: destination.id,
        page_size: 20,
      }),
    ]);

  return {
    destination,
    attractions: attractions?.items ?? [],
    hotels: hotels?.items ?? [],
    experiences: experiences?.items ?? [],
    restaurants: restaurants?.items ?? [],
    map,
    weather,
    reviews: reviews?.items ?? [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await serverFetch<Destination>(`/destinations/${slug}`);
  if (!destination) return { title: "مقصد یافت نشد" };
  return {
    title: `${destinationName(destination)} | مقصد سفر`,
    description: destination.short_description || destination.description,
    openGraph: {
      title: destinationName(destination),
      description: destination.short_description,
      images: destination.image_url ? [{ url: destination.image_url }] : [],
    },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadDestination(slug);
  if (!data) notFound();

  const { destination } = data;
  const name = destinationName(destination);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <SmartImage
          src={destination.image_url}
          alt={name}
          className="absolute inset-0 h-full w-full"
          fallbackClassName="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/70 to-brand-950/20" />
        <div className="container-app relative pb-10 pt-24 sm:pb-14 sm:pt-32">
          <div className="max-w-3xl text-white">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sand" className="bg-white/15 text-white backdrop-blur">
                <MapPin className="h-3 w-3" /> {destination.region || destination.country}
              </Badge>
              {destination.is_featured && (
                <Badge tone="brand" className="bg-brand-500 text-white">
                  پیشنهاد سیر
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] backdrop-blur">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {new Intl.NumberFormat("fa-IR").format(destination.attraction_count)} جاذبه
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">{name}</h1>
            {destination.name_local && destination.name_local !== name && (
              <div className="mt-1 text-sm text-white/60">{destination.name_local}</div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 sm:text-base">
              {destination.short_description || destination.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {destination.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] backdrop-blur"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <DestinationTabs
        destination={destination}
        attractions={data.attractions}
        hotels={data.hotels}
        experiences={data.experiences}
        restaurants={data.restaurants}
        map={data.map}
        weather={data.weather}
        reviews={data.reviews}
      />
    </>
  );
}
