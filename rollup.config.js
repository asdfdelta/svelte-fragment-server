import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import css from 'rollup-plugin-css-chunks';
import preprocess from 'svelte-preprocess';

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

const rollupConfigs = [];

// ********************FOOTER********************

rollupConfigs.push({
	input: 'src/Footer.svelte',
	output: {
		dir: 'server',
		format: 'cjs',
		name: 'Footer',
		exports: 'default'
	},
	plugins: [
		svelte({
			preprocess: preprocess({}),
			emitCss: false,
			compilerOptions: {
				// enable run-time checks when not in production
				dev: true,
				hydratable: true,
				generate: 'ssr',
				immutable: true
			}
		}),
		resolve({
			browser: false,
			dedupe: [ 'svelte' ]
		}),
		css({
			emitFiles: false
		})
	]
});

rollupConfigs.push({
	external: ['Button'],
	input: 'src/Footer.svelte',
	output: {
		dir: 'public',
		sourcemap: true,
		format: 'iife',
		name: 'Footer'
	},
	plugins: [
		svelte({
			preprocess: preprocess({}),
			compilerOptions: {
				// enable run-time checks when not in production
				dev: true,
				hydratable: true,
				generate: 'dom',
				immutable: true
			}
		}),
		resolve({
			browser: true,
			dedupe: [ 'svelte' ]
		}),
		css({
			sourcemap: true
		}),
		commonjs()
	]
});

// ********************HEADER********************

rollupConfigs.push({
	input: 'src/Header.svelte',
	output: {
		dir: 'server',
		format: 'cjs',
		name: 'Header',
		exports: 'default'
	},
	plugins: [
		svelte({
			preprocess: preprocess({}),
			emitCss: false,
			compilerOptions: {
				// enable run-time checks when not in production
				dev: true,
				hydratable: true,
				generate: 'ssr',
				immutable: true,
				css: false
			}
		}),
		resolve({
			browser: false,
			dedupe: [ 'svelte' ]
		}),
		css({
			emitFiles: false
		})
	]
});

rollupConfigs.push({
	external: ['Button'],
	input: 'src/Header.svelte',
	output: {
		dir: 'public',
		sourcemap: true,
		format: 'iife',
		name: 'Header',
		inlineDynamicImports: true
	},
	plugins: [
		svelte({
			preprocess: preprocess({}),
			compilerOptions: {
				// enable run-time checks when not in production
				dev: true,
				hydratable: true,
				generate: 'dom',
				immutable: true
			}
		}),
		resolve({
			browser: true,
			dedupe: [ 'svelte' ]
		}),
		css({
			sourcemap: true
		}),
		commonjs(),
		//serve(),
		//livereload(['public', 'server'])
	]
});

rollupConfigs.push({
	input: 'node_modules/ashcomm-core-svelte/Button/Button.svelte',
	output: {
		dir: 'public',
		sourcemap: true,
		format: 'iife',
		name: 'Button',
		inlineDynamicImports: true
	},
	plugins: [
		svelte({
			preprocess: preprocess({}),
			compilerOptions: {
				// enable run-time checks when not in production
				dev: true,
				hydratable: true,
				generate: 'dom',
				immutable: true
			}
		}),
		resolve({
			browser: true,
			dedupe: [ 'svelte' ]
		}),
		css({
			sourcemap: true
		}),
		commonjs()
	]
});

export default rollupConfigs;
