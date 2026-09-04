import type { MetadataRoute } from "next";
import { getCampusBySlug } from "@/lib/data/campuses";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const campus = await getCampusBySlug("dekut");

  return {
    name: campus.manifest_name ?? "Rumia",
    short_name: "Rumia",
    description:
      campus.manifest_description ?? "Find verified student hostels near DeKUT, Nyeri.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/images/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}