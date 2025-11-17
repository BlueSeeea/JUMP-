#!/usr/bin/env node

/**
 * 《跳跳方块》游戏快速启动器
 * 使用方法: 
 *   - 开发模式: npm run dev
 *   - 生产构建: npm run build
 *   - 部署检查: npm run check
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 配置
const CONFIG = {
    port: process.env.PORT || 8000,
    host: process.env.HOST || 'localhost',
    openBrowser: process.env.OPEN_BROWSER !== 'false'
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// 检查端口是否可用
function checkPort(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(true);
            }
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        
        server.listen(port);
    });
}

// 获取可用端口
async function getAvailablePort(startPort) {
    let port = startPort;
    while (!(await checkPort(port))) {
        port++;
        if (port > startPort + 10) {
            throw new Error('无法找到可用端口');
        }
    }
    return port;
}

// 启动开发服务器
async function startDevServer() {
    console.log('\n' + '='.repeat(50));
    log('🎮 《跳跳方块》开发服务器启动器', 'magenta');
    log('='.repeat(50), 'magenta');
    
    try {
        const availablePort = await getAvailablePort(CONFIG.port);
        if (availablePort !== CONFIG.port) {
            info(`端口 ${CONFIG.port} 被占用，使用端口 ${availablePort}`);
        }
        
        const url = `http://${CONFIG.host}:${availablePort}`;
        
        // 检查部署工具
        info('检查项目状态...');
        try {
            execSync('node deploy-check.js', { stdio: 'pipe' });
            success('项目检查通过！');
        } catch (e) {
            warning('项目检查未通过，请查看上面的错误信息');
        }
        
        info(`正在启动服务器...`);
        info(`访问地址: ${url}`);
        info('按 Ctrl+C 停止服务器\n');
        
        // 启动服务器
        const serverProcess = spawn('python', ['-m', 'http.server', availablePort.toString()], {
            stdio: 'inherit',
            shell: true
        });
        
        // 自动打开浏览器
        if (CONFIG.openBrowser) {
            setTimeout(() => {
                try {
                    const openCommand = process.platform === 'win32' ? 'start' : 
                                      process.platform === 'darwin' ? 'open' : 'xdg-open';
                    execSync(`${openCommand} ${url}`);
                    info(`已自动打开浏览器: ${url}`);
                } catch (e) {
                    info(`请手动打开浏览器访问: ${url}`);
                }
            }, 2000);
        }
        
        // 处理退出
        process.on('SIGINT', () => {
            info('\n正在关闭服务器...');
            serverProcess.kill('SIGINT');
            process.exit(0);
        });
        
        serverProcess.on('exit', (code) => {
            if (code !== 0) {
                error(`服务器异常退出 (代码: ${code})`);
                // 尝试使用Node.js serve
                tryNodeServer(availablePort);
            }
        });
        
    } catch (error) {
        error(`启动失败: ${error.message}`);
        info('尝试使用Node.js服务器...');
        tryNodeServer(availablePort);
    }
}

// 尝试使用Node.js服务器
function tryNodeServer(port) {
    try {
        const serverProcess = spawn('npx', ['serve', '.', '-p', port.toString(), '--cors'], {
            stdio: 'inherit',
            shell: true
        });
        
        process.on('SIGINT', () => {
            serverProcess.kill('SIGINT');
            process.exit(0);
        });
        
    } catch (error) {
        error('Node.js服务器也启动失败');
        info('请确保已安装Python或Node.js');
        process.exit(1);
    }
}

// 构建生产版本
function buildProduction() {
    console.log('\n' + '='.repeat(50));
    log('🏗️ 《跳跳方块》生产构建', 'magenta');
    log('='.repeat(50), 'magenta');
    
    info('正在检查项目状态...');
    
    try {
        // 运行部署检查
        execSync('node deploy-check.js', { stdio: 'inherit' });
        
        info('正在优化文件...');
        
        // 创建构建目录
        const buildDir = path.join(__dirname, 'dist');
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir);
        }
        
        // 复制文件到构建目录
        const filesToCopy = ['index.html', 'styles.css', 'script.js', 'netlify.toml'];
        filesToCopy.forEach(file => {
            const srcPath = path.join(__dirname, file);
            const destPath = path.join(buildDir, file);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                info(`已复制: ${file}`);
            }
        });
        
        success('生产构建完成！');
        info(`构建文件位于: ${buildDir}`);
        info('准备部署到Netlify或其他静态托管服务');
        
    } catch (error) {
        error(`构建失败: ${error.message}`);
        process.exit(1);
    }
}

// 显示帮助信息
function showHelp() {
    console.log(`
${colors.magenta}🎮 《跳跳方块》游戏启动器${colors.reset}

${colors.cyan}使用方法:${colors.reset}
  node start.js [命令] [选项]

${colors.cyan}命令:${colors.reset}
  dev         启动开发服务器 (默认)
  build       构建生产版本
  check       运行项目检查
  help        显示帮助信息

${colors.cyan}选项:${colors.reset}
  --port, -p <port>     指定端口 (默认: 8000)
  --host, -h <host>     指定主机 (默认: localhost)
  --no-open             不自动打开浏览器
  --help                显示帮助信息

${colors.cyan}示例:${colors.reset}
  node start.js dev                    # 启动开发服务器
  node start.js dev --port 3000        # 使用端口3000
  node start.js build                  # 构建生产版本
  node start.js check                  # 检查项目状态
`);
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'dev';
    
    // 解析参数
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--port':
            case '-p':
                CONFIG.port = parseInt(args[i + 1]) || CONFIG.port;
                i++;
                break;
            case '--host':
            case '-h':
                CONFIG.host = args[i + 1] || CONFIG.host;
                i++;
                break;
            case '--no-open':
                CONFIG.openBrowser = false;
                break;
            case '--help':
                showHelp();
                return;
        }
    }
    
    switch (command) {
        case 'dev':
            await startDevServer();
            break;
        case 'build':
            buildProduction();
            break;
        case 'check':
            execSync('node deploy-check.js', { stdio: 'inherit' });
            break;
        case 'help':
            showHelp();
            break;
        default:
            error(`未知命令: ${command}`);
            showHelp();
            process.exit(1);
    }
}

// 错误处理
process.on('uncaughtException', (error) => {
    error(`未捕获的异常: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    error(`未处理的Promise拒绝: ${reason}`);
    process.exit(1);
});

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('启动器运行失败:', error);
        process.exit(1);
    });
}

module.exports = { startDevServer, buildProduction };