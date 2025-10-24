import fs from 'fs';
import path from 'path';
import { parseReviewListFromHtml } from '../src/renderer/services/postmanParser';

const srcHtml = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'postman', 'list.html');
const html = fs.readFileSync(srcHtml, 'utf-8');

const items = parseReviewListFromHtml(html);

const outDir = path.join(__dirname, '..', 'build', 'postman');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'list.json');
fs.writeFileSync(outFile, JSON.stringify(items, null, 2), 'utf-8');
// also write to src assets so dev server can serve it
const devOut = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'postman', 'list.json');
fs.writeFileSync(devOut, JSON.stringify(items, null, 2), 'utf-8');
console.log('Wrote', outFile, 'and', devOut, 'with', items.length, 'items');
 
