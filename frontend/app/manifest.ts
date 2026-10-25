import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سیر | سوپراپ سفر ایران",
    short_name: "سیر",
    description: "جستجو، رزرو و برنامه‌ریزی هوشمند سفر در سراسر ایران.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3e9",
    theme_color: "#0e7c66",
    lang: "fa",
    dir: "rtl",
    categories: ["travel", "lifestyle"],
    icons: [
      {
        src: "/brand-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
