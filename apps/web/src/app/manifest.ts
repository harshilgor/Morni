import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Morni",
    short_name: "Morni",
    description:
      "Browse UAE boutique offerings and get fashion delivered within the hour.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#70001f",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
