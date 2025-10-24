// wrapper to run the TypeScript parser using ts-node
require('ts-node').register({
	transpileOnly: true,
	compilerOptions: {
		moduleResolution: 'NodeNext',
		module: 'NodeNext',
		esModuleInterop: true,
		allowSyntheticDefaultImports: true
	}
});
require('./parse-list.ts');
