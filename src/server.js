const http = require('http');
const https = require('https');
const nStatic = require('node-static');

//require('svelte/register');

const fileServer = new nStatic.Server('./public');

//http://localhost:3001/
const hostname = '127.0.0.1';
const port = 3001;

const requireCache = [];

const renderComponent = function(req, res, componentName, props, target) {
	//delete require.cache[`../server/${componentName}.js`];
	//const ssr = require(`../server/${componentName}.js`);
	const ssr = requireCache[componentName] || (requireCache[componentName] = require(`../server/${componentName}.js`));

	const { html, head } = ssr.render(props);

	// Add stuff that goes in <head>
	if (head) {
		res.write('<head>');

		res.write(`<link rel="stylesheet" href="/eo-ssr-test2/${componentName}.css">`);

		if (head) {
			res.write(head);
		}

		res.write('</head>');
	}

	// Add the hydration script to the footer
	let wrapperId;

	if (!target) {
		wrapperId = 'the-app';
		target = `document.getElementById("${wrapperId}")`;
	}

	res.write('<main>');
	// End with the SSR HTML
	if (wrapperId)
		res.write(`<div id="${wrapperId}">${html}</div>`);
	else
		res.write(html);

	res.write('</main>');

	res.write('<footer>');
	res.write(`<script src="/eo-ssr-test2/${componentName}.js"></script>`);
	res.write(`<script>new ${componentName}({target: ${target}, hydrate: true, props: ${JSON.stringify(props)}});</script>`);
	res.end('</footer>');
};

const renderBodyComponent = function(req, res) {
	const props = {
		name: 'SSR Testing',
		dateString: 'Waiting for the client'
	};

	return renderComponent(req, res, 'Body', props);
};

const renderHeaderComponent = function(req, res) {
	/*let links = '';

	https.get('https://ecomm-products.dev.ashleyretail.com/categories?r=true&f=false', apiRes => {
		// A chunk of data has been received.
		apiRes.on('data', (chunk) => {
		  links += chunk;
		});
	}).end();
console.log('links: ' + links);
	links = JSON.parse(links);

	return renderComponent(req, res, 'Header', {links: links}, 'document.getElementsByTagName("header")[0]')
	*/
	return renderComponent(req, res, 'Header', {}, 'document.getElementsByTagName("header")[0]')
};

const renderFooterComponent = function(req, res) {
	return renderComponent(req, res, 'Footer', {}, 'document.getElementsByTagName("footer")[0]')
};

const serveComponentHydration = function(req, res, componentName) {
	return fileServer.serveFile(`/${componentName}.js`, 200, {}, req, res);
};

const serveComponentStyles = function(req, res, componentName) {
	return fileServer.serveFile(`/${componentName}.css`, 200, {}, req, res);
};

const server = http.createServer((req, res) => {
	const url = req.url;

	switch (url) {
		case '/eo-ssr-test2/component/body':
			return renderBodyComponent(req, res);
		case '/eo-ssr-test2/component/header':
			return renderHeaderComponent(req, res);
		case '/eo-ssr-test2/component/footer':
			return renderFooterComponent(req, res);
		case '/eo-ssr-test2/Footer.js':
			return serveComponentHydration(req, res, 'Footer');
		case '/eo-ssr-test2/Header.js':
			return serveComponentHydration(req, res, 'Header');
		case '/eo-ssr-test2/Footer.css':
			return serveComponentStyles(req, res, 'Footer');
		case '/eo-ssr-test2/Header.css':
			return serveComponentStyles(req, res, 'Header');
		default:
			res.statusCode = 400;
			res.end();
			break;
	}
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
