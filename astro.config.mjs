import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://dat267.github.io',
	integrations: [
		starlight({
			title: 'dat267.github.io',
			customCss: [
				'./src/styles/custom.css'
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/dat267/dat267.github.io' }
			]
		}),
	],
});
