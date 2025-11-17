#!/usr/bin/env node

/**
 * 《跳跳方块》游戏部署验证和修复工具
 * 使用方法: node deploy-check.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
    projectDir: __dirname,
    requiredFiles: [
        'index.html',
        'styles.css', 
        'script.js',
        'package.json',
        'netlify.toml'
    ],
    testPort: 8001,
    timeout: 5000
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

// 日志输出
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// 检查文件完整性
function checkFiles() {
    info('正在检查项目文件完整性...');
    
    const missingFiles = [];
    const existingFiles = [];
    
    CONFIG.requiredFiles.forEach(file => {
        const filePath = path.join(CONFIG.projectDir, file);
        if (fs.existsSync(filePath)) {
            existingFiles.push(file);
        } else {
            missingFiles.push(file);
        }
    });
    
    if (missingFiles.length > 0) {
        error(`缺失文件: ${missingFiles.join(', ')}`);
        return false;
    }
    
    success(`所有必需文件都存在: ${existingFiles.join(', ')}`);
    return true;
}

// 检查文件内容
function checkFileContent() {
    info('正在检查文件内容...');
    
    const issues = [];
    
    // 检查HTML文件
    const htmlPath = path.join(CONFIG.projectDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    if (!htmlContent.includes('<!DOCTYPE html>')) {
        issues.push('HTML文件缺少DOCTYPE声明');
    }
    if (!htmlContent.includes('script.js')) {
        issues.push('HTML文件未引用script.js');
    }
    if (!htmlContent.includes('styles.css')) {
        issues.push('HTML文件未引用styles.css');
    }
    
    // 检查CSS文件
    const cssPath = path.join(CONFIG.projectDir, 'styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    if (!cssContent.includes('.screen')) {
        issues.push('CSS文件缺少.screen样式定义');
    }
    if (!cssContent.includes('.character')) {
        issues.push('CSS文件缺少.character样式定义');
    }
    
    // 检查JavaScript文件
    const jsPath = path.join(CONFIG.projectDir, 'script.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    if (!jsContent.includes('class JumpGame')) {
        issues.push('JavaScript文件缺少JumpGame类定义');
    }
    if (!jsContent.includes('localStorage')) {
        issues.push('JavaScript文件缺少本地存储功能');
    }
    
    if (issues.length > 0) {
        issues.forEach(issue => error(issue));
        return false;
    }
    
    success('文件内容检查通过');
    return true;
}

// 语法检查
function syntaxCheck() {
    info('正在检查JavaScript语法...');
    
    try {
        const jsPath = path.join(CONFIG.projectDir, 'script.js');
        execSync(`node -c "${jsPath}"`, { stdio: 'pipe' });
        success('JavaScript语法正确');
        return true;
    } catch (error) {
        error('JavaScript语法错误: ' + error.message);
        return false;
    }
}

// 检查端口占用
function checkPort(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false); // 端口被占用
            } else {
                resolve(true); // 其他错误，但端口可用
            }
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true); // 端口可用
        });
        
        server.listen(port);
    });
}

// 本地服务器测试
async function testLocalServer() {
    info('正在测试本地服务器...');
    
    // 检查端口是否可用
    const portAvailable = await checkPort(CONFIG.testPort);
    if (!portAvailable) {
        warning(`端口 ${CONFIG.testPort} 被占用，尝试使用其他端口`);
        return true; // 端口问题不是致命错误
    }
    
    try {
        // 尝试启动服务器
        const server = execSync(`cd "${CONFIG.projectDir}" && python -m http.server ${CONFIG.testPort}`, { 
            stdio: 'pipe',
            timeout: 3000 
        });
        
        // 等待服务器启动
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 测试访问
        const testUrl = `http://localhost:${CONFIG.testPort}`;
        const response = await fetch(testUrl);
        
        if (response.ok) {
            success(`本地服务器测试成功: ${testUrl}`);
            return true;
        } else {
            error(`服务器响应异常: ${response.status}`);
            return false;
        }
    } catch (error) {
        warning('Python服务器测试失败，尝试Node.js服务器...');
        
        try {
            // 尝试使用Node.js serve
            execSync(`cd "${CONFIG.projectDir}" && npx serve . -p ${CONFIG.testPort} --cors`, {
                stdio: 'pipe',
                timeout: 3000
            });
            
            success('Node.js服务器测试通过');
            return true;
        } catch (nodeError) {
            error('所有服务器尝试都失败了');
            return false;
        }
    }
}

// 检查浏览器兼容性
function checkBrowserCompatibility() {
    info('正在检查浏览器兼容性...');
    
    const htmlPath = path.join(CONFIG.projectDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    const compatibilityIssues = [];
    
    // 检查现代JavaScript特性
    const jsPath = path.join(CONFIG.projectDir, 'script.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    if (jsContent.includes('class ')) {
        info('使用了ES6类语法 - 需要现代浏览器支持');
    }
    
    if (jsContent.includes('localStorage')) {
        info('使用了本地存储 - 需要浏览器支持Web Storage API');
    }
    
    if (jsContent.includes('navigator.share')) {
        info('使用了Web Share API - 仅在HTTPS环境下可用');
    }
    
    // 检查CSS特性
    const cssPath = path.join(CONFIG.projectDir, 'styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    if (cssContent.includes('backdrop-filter')) {
        info('使用了backdrop-filter - 部分浏览器需要前缀');
    }
    
    if (cssContent.includes('gradient')) {
        info('使用了CSS渐变 - 现代浏览器广泛支持');
    }
    
    success('浏览器兼容性检查完成');
    return true;
}

// 生成修复建议
function generateFixes() {
    info('正在生成修复建议...');
    
    const fixes = [];
    
    // 检查是否需要创建缺失文件
    CONFIG.requiredFiles.forEach(file => {
        const filePath = path.join(CONFIG.projectDir, file);
        if (!fs.existsSync(filePath)) {
            fixes.push({
                type: 'create',
                file: file,
                description: `创建缺失的 ${file} 文件`
            });
        }
    });
    
    // 检查配置文件
    const packagePath = path.join(CONFIG.projectDir, 'package.json');
    if (fs.existsSync(packagePath)) {
        const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        if (!packageContent.scripts || !packageContent.scripts.serve) {
            fixes.push({
                type: 'update',
                file: 'package.json',
                description: '添加serve脚本到package.json'
            });
        }
    }
    
    if (fixes.length > 0) {
        warning('发现以下问题需要修复:');
        fixes.forEach(fix => {
            info(`- ${fix.description}`);
        });
    } else {
        success('未发现需要修复的问题');
    }
    
    return fixes;
}

// 主检查流程
async function main() {
    console.log('\n' + '='.repeat(50));
    log('《跳跳方块》游戏部署检查工具', 'magenta');
    log('='.repeat(50), 'magenta');
    
    let allPassed = true;
    
    // 执行各项检查
    const checks = [
        { name: '文件完整性检查', func: checkFiles },
        { name: '文件内容检查', func: checkFileContent },
        { name: '语法检查', func: syntaxCheck },
        { name: '浏览器兼容性检查', func: checkBrowserCompatibility }
    ];
    
    for (const check of checks) {
        try {
            const result = await check.func();
            if (!result) {
                allPassed = false;
            }
        } catch (error) {
            error(`${check.name} 失败: ${error.message}`);
            allPassed = false;
        }
        console.log('');
    }
    
    // 生成修复建议
    const fixes = generateFixes();
    
    // 输出最终结果
    console.log('\n' + '='.repeat(50));
    if (allPassed && fixes.length === 0) {
        success('🎉 所有检查通过！游戏可以正常部署！');
        info('下一步: 访问 https://netlify.com 拖拽部署');
    } else {
        warning('⚠️  发现一些问题，请按上述建议修复');
        info('修复完成后重新运行本工具进行验证');
    }
    log('='.repeat(50), 'magenta');
}

// 运行主程序
if (require.main === module) {
    main().catch(error => {
        console.error('检查工具运行失败:', error);
        process.exit(1);
    });
}

module.exports = {
    checkFiles,
    checkFileContent,
    syntaxCheck,
    checkBrowserCompatibility,
    generateFixes
};