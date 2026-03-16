// proxy.js — รัน: node proxy.js
// แล้วเปิด http://localhost:8080

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STREAM_HOST = 'www.livedoomovies.com';
const STREAM_PORT = 4431;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 7.1.2; TV BOX Build/NHG47L) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36';
const REFERRER = 'https://www.88-hd.com/';

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);

    // CORS headers สำหรับทุก request
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Serve index.html
    if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
        const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(html);
        return;
    }

    // Proxy stream requests
    if (parsed.pathname.startsWith('/stream')) {
        const streamPath = parsed.pathname.replace('/stream', '') || '/02_3HD_720p/playlist.m3u8';

        const options = {
            hostname: STREAM_HOST,
            port: STREAM_PORT,
            path: streamPath,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': REFERRER,
                'Origin': 'https://www.88-hd.com',
            },
            rejectUnauthorized: false, // bypass self-signed cert
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let contentType = proxyRes.headers['content-type'] || '';

            // กำหนด content-type ที่ถูกต้อง
            if (streamPath.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
            if (streamPath.endsWith('.ts'))   contentType = 'video/mp2t';

            res.setHeader('Content-Type', contentType);
            res.writeHead(proxyRes.statusCode);

            // ถ้าเป็น m3u8 ให้ rewrite URLs ชี้กลับมาที่ proxy
            if (streamPath.endsWith('.m3u8')) {
                let body = '';
                proxyRes.on('data', chunk => body += chunk.toString());
                proxyRes.on('end', () => {
                    // แทน path ของ .ts และ .m3u8 ให้ชี้ผ่าน proxy
                    const basePath = streamPath.substring(0, streamPath.lastIndexOf('/') + 1);
                    body = body.replace(/^(?!#)(.+\.(m3u8|ts).*)$/gm, (match) => {
                        if (match.startsWith('http')) {
                            // absolute URL — แปลง path
                            const u = new URL(match);
                            return `/stream${u.pathname}`;
                        }
                        return `/stream${basePath}${match}`;
                    });
                    res.end(body);
                });
            } else {
                proxyRes.pipe(res);
            }
        });

        proxyReq.on('error', (e) => {
            console.error('Proxy error:', e.message);
            res.writeHead(502);
            res.end('Proxy error: ' + e.message);
        });

        proxyReq.end();
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n✅ Proxy server รันที่ http://localhost:${PORT}`);
    console.log(`📺 เปิดเบราว์เซอร์ไปที่ http://localhost:${PORT}\n`);
});
