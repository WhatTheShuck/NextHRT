import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Next HRT",
    short_name: "NextHRT",
    description:
      "Internal KSB Australia Ticket and Licence Management Software",
    start_url: "/",
    display: "standalone",
    background_color: "#003674",
    theme_color: "#003674",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
