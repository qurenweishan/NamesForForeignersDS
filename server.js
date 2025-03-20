const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 日志记录函数
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

// 读取favicon.ico文件
const faviconPath = path.join(__dirname, 'favicon.ico');
let faviconContent = null;
try {
    faviconContent = fs.readFileSync(faviconPath);
    log('成功加载favicon.ico');
} catch (err) {
    log('favicon.ico不存在，将使用空图标', 'warn');
    faviconContent = Buffer.from('');
}

const server = http.createServer((req, res) => {
    const requestStart = Date.now();
    log(`收到请求: ${req.method} ${req.url}`);

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        log('处理OPTIONS预检请求');
        return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                log(`加载index.html失败: ${err.message}`, 'error');
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            log('成功加载index.html');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
    } else if (req.url === '/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        res.end(faviconContent);
        log('提供favicon.ico');
    } else if (req.method === 'GET' && req.url === '/script.js') {
        const filePath = path.join(__dirname, 'script.js');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                log(`加载script.js失败: ${err.message}`, 'error');
                res.writeHead(500);
                res.end('Error loading script.js');
                return;
            }
            log('成功加载script.js');
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(content);
        });
    } else if (req.method === 'POST' && req.url === '/generate-names') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let englishName;
            try {
                const parsedBody = JSON.parse(body);
                englishName = parsedBody.englishName;
                log(`接收到生成名字请求，英文名: ${englishName}`);
            } catch (error) {
                log(`解析请求体失败: ${error.message}`, 'error');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的请求数据' }));
                return;
            }

            const prompt = `作为一个专业的中文取名专家，请为英文名"${englishName}"生成3个有趣的中文名字。要求：
1. 每个名字都要体现中国文化特色
2. 名字要有一定的幽默感或包含有趣的梗
3. 要理解英文名的含义，并在中文名中反映出来
4. 为每个名字提供详细的中英文解释

请用JSON格式返回，格式如下：
{
    "names": [
        {
            "chinese": "中文名1",
            "explanation": {
                "chinese": "中文解释",
                "english": "English explanation"
            }
        },
        // 类似的结构重复两次
    ]
}`;

            const requestData = {
                model: 'deepseek-r1-250120',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的中文取名专家，擅长为外国人起有趣且富有文化内涵的中文名字。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                timeout: 120000 // 120秒超时
            };

            log('准备发送API请求');
            log(`API请求数据: ${JSON.stringify(requestData)}`);

            const apiReq = https.request(API_URL, options, (apiRes) => {
                log(`API响应状态码: ${apiRes.statusCode}`);
                let data = '';

                apiRes.on('data', (chunk) => {
                    data += chunk;
                });

                apiRes.on('end', () => {
                    log(`收到完整的API响应: ${data}`);
                    if (apiRes.statusCode === 200) {
                        try {
                            const apiResponse = JSON.parse(data);
                            log('成功解析API响应JSON');

                            if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message) {
                                throw new Error('API响应格式不正确');
                            }

                            const content = apiResponse.choices[0].message.content;
                            log('成功获取API响应内容');
                            
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ choices: [{ message: { content } }] }));
                            log(`请求处理完成，耗时: ${Date.now() - requestStart}ms`);
                        } catch (error) {
                            log(`解析API响应失败: ${error.message}`, 'error');
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `解析API响应失败：${error.message}` }));
                        }
                    } else {
                        log(`API请求失败，状态码: ${apiRes.statusCode}`, 'error');
                        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: `API请求失败：HTTP ${apiRes.statusCode}` }));
                    }
                });
            });

            apiReq.on('error', (error) => {
                log(`API请求出错: ${error.message}`, 'error');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '服务器错误：' + error.message }));
            });

            apiReq.on('timeout', () => {
                log('API请求超时', 'error');
                apiReq.destroy();
                res.writeHead(504, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '请求超时' }));
            });

            apiReq.write(JSON.stringify(requestData));
            apiReq.end();
        });
    } else {
        log(`未知请求: ${req.method} ${req.url}`, 'warn');
        res.writeHead(404);
        res.end();
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    log(`服务器启动成功，监听端口 ${PORT}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    log(`未捕获的异常: ${error.message}`, 'error');
    log(error.stack, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
    log(`未处理的Promise拒绝: ${reason}`, 'error');
});