import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://dat267.github.io",
  integrations: [
    starlight({
      title: "dat267.github.io",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/dat267/dat267.github.io",
        },
      ],
      lastUpdated: true,
      customCss: ["./src/styles/webapps.css"],
    }),
  ],
});
