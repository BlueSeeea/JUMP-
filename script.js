// 游戏状态管理
class GameState {
    constructor() {
        this.currentScreen = 'home';
        this.score = 0;
        this.combo = 1;
        this.perfectCount = 0;
        this.maxCombo = 1;
        this.isPlaying = false;
        this.isCharging = false;
        this.power = 0;
        this.character = {
            x: 0, // 将在生成第一个平台时设置
            y: 0, // 将在生成第一个平台时设置
            width: 40,
            height: 40,
            vx: 0,
            vy: 0,
            isJumping: false
        };
        this.platforms = [];
        this.trajectory = [];
        this.gameSpeed = 1;
        this.platformSpeed = 0.5;
        this.lastPlatformX = 0;
        this.currentSkin = 'default';
        this.skins = {
            default: { color: '#ff6b6b', unlocked: true },
            cat: { color: '#ffa726', unlocked: false, requirement: 500 },
            astronaut: { color: '#42a5f5', unlocked: false, requirement: 1000 },
            rainbow: { color: 'linear-gradient(45deg, #ff6b6b, #ffa726, #42a5f5)', unlocked: false, requirement: 2000 }
        };
        // 新增系统相关状态
        this.isFirstGame = true;
        this.hasSetNickname = false;
        this.jumpData = {
            reactionTime: 0,
            positionDelta: 0,
            perfectStreak: 0,
            trajectory: [],
            landingVelocity: { x: 0, y: 0 },
            landingAngle: 0,
            optimalTiming: 500,
            actualTiming: 0
        };
        this.gameStartTime = 0;
        this.lastJumpTime = 0;
        
        // 轨迹优化相关
        this.trajectoryCache = new Map();
        this.lastTrajectoryPower = -1;
        this.trajectoryDots = [];
        
        // 游戏失败检测相关
        this.fallStartTime = null; // 用于检测长时间异常下落
        
        // 平台附着和底部碰撞检测相关
        this.attachedPlatform = null; // 当前附着的平台
        this.platformAttachmentOffset = 0; // 与附着平台的相对位置偏移
        this.bottomCollisionLine = null; // 底部碰撞检测线
    }
}

// 游戏主类
class JumpGame {
    constructor() {
        this.state = new GameState();
        this.gameSystem = new GameSystems.GameSystemIntegration(); // 集成新系统
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadGameData();
        this.updateUI();
        this.generateInitialPlatforms();
        this.updateCharacterPosition();
    }

    bindEvents() {
        // 首页按钮
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('rankingBtn').addEventListener('click', () => this.showRanking());
        document.getElementById('skinsBtn').addEventListener('click', () => this.showSkins());

        // 游戏控制
        document.addEventListener('mousedown', (e) => this.startCharging(e));
        document.addEventListener('mouseup', (e) => this.jump(e));
        document.addEventListener('touchstart', (e) => this.startCharging(e));
        document.addEventListener('touchend', (e) => this.jump(e));

        // 游戏结束界面
        document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
        document.getElementById('backHomeBtn').addEventListener('click', () => this.showHome());
        document.getElementById('shareBtn').addEventListener('click', () => this.shareScore());

        // 排行榜界面
        document.getElementById('saveNameBtn').addEventListener('click', () => this.savePlayerName());
        document.getElementById('backFromRankingBtn').addEventListener('click', () => this.showHome());

        // 皮肤界面
        document.getElementById('backFromSkinsBtn').addEventListener('click', () => this.showHome());

        // 新增系统事件绑定
        document.getElementById('languageSelect').addEventListener('change', (e) => this.changeLanguage(e));
        document.getElementById('saveFirstNickname').addEventListener('click', () => this.saveFirstNickname());
        document.getElementById('skipFirstNickname').addEventListener('click', () => this.skipFirstNickname());
        document.getElementById('dismissStorageWarning').addEventListener('click', () => this.dismissStorageWarning());

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.startCharging(e);
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump(e);
            }
        });
    }

    loadGameData() {
        // 使用双备份存储系统
        const savedData = this.gameSystem && this.gameSystem.dualStorage ? this.gameSystem.dualStorage.getItem('jumpGameData') : localStorage.getItem('jumpGameData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.state.skins = { ...this.state.skins, ...data.skins };
            this.state.currentSkin = data.currentSkin || 'default';
            this.state.isFirstGame = data.isFirstGame !== false; // 默认是首次游戏
            this.state.hasSetNickname = data.hasSetNickname || false;
            document.getElementById('highScore').textContent = data.highScore || 0;
            document.getElementById('gameCount').textContent = data.gameCount || 0;
        }
        
        // 更新系统状态显示
        this.updateSystemStatus();
        
        // 初始化语言选择器
        this.initializeLanguageSelector();
    }

    saveGameData() {
        const data = {
            skins: this.state.skins,
            currentSkin: this.state.currentSkin,
            highScore: parseInt(document.getElementById('highScore').textContent),
            gameCount: parseInt(document.getElementById('gameCount').textContent),
            isFirstGame: this.state.isFirstGame,
            hasSetNickname: this.state.hasSetNickname
        };
        // 使用双备份存储系统
        if (this.gameSystem && this.gameSystem.dualStorage) {
            this.gameSystem.dualStorage.setItem('jumpGameData', JSON.stringify(data));
        } else {
            localStorage.setItem('jumpGameData', JSON.stringify(data));
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showHome() {
        this.state.currentScreen = 'home';
        this.showScreen('homeScreen');
        this.updateUI();
    }

    startGame() {
        this.state.currentScreen = 'game';
        this.state.score = 0;
        this.state.combo = 1;
        this.state.perfectCount = 0;
        this.state.maxCombo = 1;
        this.state.isPlaying = true;
        this.state.character = {
            x: 0, // 将在生成第一个平台时设置
            y: 0, // 将在生成第一个平台时设置
            width: 40,
            height: 40,
            vx: 0,
            vy: 0,
            isJumping: false
        };
        this.state.platforms = [];
        this.state.trajectory = [];
        this.state.gameSpeed = 1;
        this.state.platformSpeed = 0.5;
        this.state.lastPlatformX = 0;
        
        // 重置充电和跳跃状态
        this.state.isCharging = false;
        this.state.power = 0;

        this.showScreen('gameScreen');
        this.createBottomCollisionLine(); // 创建底部碰撞检测线
        this.generateInitialPlatforms();
        this.updateCharacterPosition();
        this.updateUI();
        this.startGameLoop();
    }

    showRanking() {
        this.state.currentScreen = 'ranking';
        this.showScreen('rankingScreen');
        this.loadRanking();
    }

    showSkins() {
        this.state.currentScreen = 'skins';
        this.showScreen('skinsScreen');
        this.loadSkins();
    }

    createBottomCollisionLine() {
        // 创建底部碰撞检测线（不可见）
        const bottomLineY = window.innerHeight - 10; // 距离底部10像素
        this.state.bottomCollisionLine = {
            x: 0,
            y: bottomLineY,
            width: window.innerWidth,
            height: 5, // 5像素高的碰撞检测线
            isVisible: false
        };
        
        console.log(`底部碰撞检测线已创建: y=${bottomLineY}, width=${window.innerWidth}`);
    }
    
    generateInitialPlatforms() {
        this.state.platforms = [];
        
        // 生成第一个平台 - 特别长且位置合适，给玩家良好开始
        const firstPlatform = {
            x: 80, // 稍微靠右，给玩家更多空间
            y: 320, // 适中的高度，便于起跳
            width: 250, // 更长的起始平台
            height: 20,
            type: 'normal',
            id: Date.now() + Math.random(),
            hasCollision: true
        };
        
        this.state.platforms.push(firstPlatform);
        this.state.lastPlatformX = firstPlatform.x + firstPlatform.width;
        
        // 创建第一个平台的DOM元素
        const firstPlatformEl = document.createElement('div');
        firstPlatformEl.className = 'platform normal';
        firstPlatformEl.style.left = firstPlatform.x + 'px';
        firstPlatformEl.style.top = firstPlatform.y + 'px';
        firstPlatformEl.style.width = firstPlatform.width + 'px';
        firstPlatformEl.style.height = firstPlatform.height + 'px';
        firstPlatformEl.id = `platform-${firstPlatform.id}`;
        firstPlatformEl.setAttribute('data-has-collision', 'true');
        
        document.getElementById('platforms').appendChild(firstPlatformEl);
        
        // 将玩家角色放置在第一个平台上，稍微偏左便于向右跳跃
        this.state.character.x = firstPlatform.x + 60; // 平台左侧偏右位置
        this.state.character.y = firstPlatform.y - this.state.character.height;
        
        // 生成剩余的4个平台，确保第二个平台在合理位置
        const secondPlatform = {
            x: firstPlatform.x + firstPlatform.width + 120, // 合理的间距
            y: 280 + Math.random() * 60, // 稍微高一点，增加挑战性
            width: 80 + Math.random() * 40,
            height: 20,
            type: 'normal', // 只使用普通平台
            id: Date.now() + Math.random() + 1,
            hasCollision: true
        };
        
        this.state.platforms.push(secondPlatform);
        this.state.lastPlatformX = secondPlatform.x + secondPlatform.width;
        
        const secondPlatformEl = document.createElement('div');
        secondPlatformEl.className = `platform ${secondPlatform.type}`;
        secondPlatformEl.style.left = secondPlatform.x + 'px';
        secondPlatformEl.style.top = secondPlatform.y + 'px';
        secondPlatformEl.style.width = secondPlatform.width + 'px';
        secondPlatformEl.style.height = secondPlatform.height + 'px';
        secondPlatformEl.id = `platform-${secondPlatform.id}`;
        secondPlatformEl.setAttribute('data-has-collision', 'true');
        
        document.getElementById('platforms').appendChild(secondPlatformEl);
        
        // 生成剩余的3个平台
        for (let i = 2; i < 5; i++) {
            this.generatePlatform();
        }
    }

    generatePlatform() {
        // 只保留最基本的普通平台，删除所有特殊效果
        const type = 'normal';

        // 智能平台生成算法
        const screenWidth = window.innerWidth;
        const minDistance = 100; // 最小平台间距
        const maxDistance = 180; // 最大平台间距
        const minHeight = 200; // 最小高度
        const maxHeight = 400; // 最大高度
        
        // 计算平台宽度和高度
        const platformWidth = Math.max(50, 60 + Math.random() * 40); // 最小宽度50px
        const platformHeight = 20; // 固定高度，避免碰撞箱异常
        
        // 智能位置计算
        let platformX, platformY;
        
        if (this.state.platforms.length === 0) {
            // 第一个平台
            platformX = Math.max(screenWidth * 0.3, this.state.lastPlatformX + minDistance);
            platformY = 300; // 初始高度
        } else {
            // 基于前一个平台计算位置
            const lastPlatform = this.state.platforms[this.state.platforms.length - 1];
            const lastRight = lastPlatform.x + lastPlatform.width;
            
            // X轴位置：在前一个平台右侧一定距离
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            platformX = lastRight + distance;
            
            // Y轴位置：基于前一个平台高度，限制变化范围
            const lastY = lastPlatform.y;
            const maxHeightChange = 80; // 最大高度变化
            const heightChange = (Math.random() - 0.5) * maxHeightChange * 2;
            platformY = Math.max(minHeight, Math.min(maxHeight, lastY + heightChange));
            
            // 确保不会太靠近屏幕顶部或底部
            if (platformY < minHeight + 50) {
                platformY = minHeight + 50 + Math.random() * 50;
            } else if (platformY > maxHeight - 50) {
                platformY = maxHeight - 50 - Math.random() * 50;
            }
        }
        
        // 确保平台在合理范围内
        platformX = Math.max(screenWidth * 0.5, platformX);
        
        const platform = {
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: platformHeight,
            type: type,
            id: Date.now() + Math.random(),
            hasCollision: true, // 显式标记该平台有碰撞检测
            speed: Math.random() > 0.7 ? (Math.random() - 0.5) * 2 : 0, // 30%概率生成移动平台，速度范围-1到1
            direction: Math.random() > 0.5 ? 1 : -1, // 移动方向
            moveRange: 50 + Math.random() * 100, // 移动范围
            originalX: platformX // 记录原始位置用于范围限制
        };

        this.state.platforms.push(platform);
        this.state.lastPlatformX = platform.x;

        // 创建平台DOM元素
        const platformEl = document.createElement('div');
        platformEl.className = `platform ${type}`;
        platformEl.style.left = platform.x + 'px';
        platformEl.style.top = platform.y + 'px';
        platformEl.style.width = platform.width + 'px';
        platformEl.style.height = platform.height + 'px';
        platformEl.id = `platform-${platform.id}`;
        platformEl.setAttribute('data-has-collision', 'true'); // 添加碰撞检测标记
        
        document.getElementById('platforms').appendChild(platformEl);
    }

    startCharging(e) {
        if (!this.state.isPlaying || this.state.character.isJumping || this.state.isCharging) return;
        
        this.state.isCharging = true;
        this.state.power = 0;
        this.chargePower();
        
        // 开始显示轨迹预测
        this.showTrajectoryPrediction();
    }

    chargePower() {
        if (!this.state.isCharging) return;
        
        // 增加蓄力最大值到150，让跳跃更有力
        this.state.power = Math.min(this.state.power + 2, 150);
        document.getElementById('powerFill').style.width = Math.min(this.state.power, 100) + '%';
        
        // 显示轨迹和预测
        this.showTrajectory();
        this.showTrajectoryPrediction();
        
        requestAnimationFrame(() => this.chargePower());
    }

    showTrajectory() {
        const power = this.state.power;
        
        // 使用缓存避免重复计算
        if (this.state.lastTrajectoryPower === power && this.state.trajectoryDots.length > 0) {
            this.updateTrajectoryVisibility();
            return;
        }
        
        this.state.lastTrajectoryPower = power;
        
        // 清除旧轨迹
        const trajectoryContainer = document.getElementById('trajectory');
        trajectoryContainer.innerHTML = '';
        
        const startX = this.state.character.x + this.state.character.width / 2;
        const startY = this.state.character.y;
        const powerRatio = power / 100;
        
        // 检查缓存
        const cacheKey = `${startX}-${startY}-${power}`;
        if (this.state.trajectoryCache.has(cacheKey)) {
            this.renderCachedTrajectory(this.state.trajectoryCache.get(cacheKey));
            return;
        }
        
        // 优化的物理参数
        const gravity = 0.8;
        const baseVelocity = 8;
        const maxVelocity = 20;
        
        // 计算初始速度
        const initialVelocity = baseVelocity + (maxVelocity - baseVelocity) * powerRatio;
        const angle = -Math.PI / 4; // 45度向上
        
        const vx = initialVelocity * Math.cos(angle);
        const vy = initialVelocity * Math.sin(angle);
        
        // 预测落点和飞行时间
        const flightTime = (-2 * vy) / gravity;
        const jumpDistance = vx * flightTime;
        
        // 生成轨迹点数据
        const trajectoryPoints = [];
        const pointCount = Math.min(15, Math.max(8, Math.floor(powerRatio * 15)));
        
        for (let i = 0; i <= pointCount; i++) {
            const t = (i / pointCount) * flightTime;
            const x = startX + vx * t;
            const y = startY + vy * t + 0.5 * gravity * t * t;
            
            // 只保留可见范围内的点
            if (x > -50 && x < window.innerWidth + 50 && y > -50 && y < window.innerHeight + 50) {
                trajectoryPoints.push({
                    x: x,
                    y: y,
                    alpha: 1 - (i / pointCount) * 0.7,
                    scale: 1 - (i / pointCount) * 0.3,
                    time: t
                });
            }
        }
        
        // 缓存结果
        this.state.trajectoryCache.set(cacheKey, trajectoryPoints);
        if (this.state.trajectoryCache.size > 50) { // 限制缓存大小
            const firstKey = this.state.trajectoryCache.keys().next().value;
            this.state.trajectoryCache.delete(firstKey);
        }
        
        this.renderCachedTrajectory(trajectoryPoints);
    }
    
    renderCachedTrajectory(trajectoryPoints) {
        const trajectoryContainer = document.getElementById('trajectory');
        const fragment = document.createDocumentFragment();
        
        // 重用现有的轨迹点元素
        const existingDots = this.state.trajectoryDots.filter(dot => dot.parentNode);
        
        trajectoryPoints.forEach((point, index) => {
            let dot;
            
            // 重用现有元素或创建新元素
            if (index < existingDots.length) {
                dot = existingDots[index];
                dot.style.opacity = point.alpha;
                dot.style.transform = `scale(${point.scale})`;
                dot.style.left = point.x + 'px';
                dot.style.top = point.y + 'px';
                dot.style.display = 'block';
            } else {
                dot = document.createElement('div');
                dot.className = 'trajectory-dot';
                dot.style.left = point.x + 'px';
                dot.style.top = point.y + 'px';
                dot.style.opacity = point.alpha;
                dot.style.transform = `scale(${point.scale})`;
                fragment.appendChild(dot);
                
                if (index < 30) { // 限制缓存的元素数量
                    this.state.trajectoryDots.push(dot);
                }
            }
        });
        
        // 隐藏多余的现有元素
        for (let i = trajectoryPoints.length; i < existingDots.length; i++) {
            existingDots[i].style.display = 'none';
        }
        
        if (fragment.children.length > 0) {
            trajectoryContainer.appendChild(fragment);
        }
    }
    
    updateTrajectoryVisibility() {
        // 更新轨迹可见性（用于缓存命中时）
        const trajectoryContainer = document.getElementById('trajectory');
        if (trajectoryContainer.children.length === 0) return;
        
        const characterX = this.state.character.x + this.state.character.width / 2;
        const characterY = this.state.character.y;
        
        Array.from(trajectoryContainer.children).forEach(dot => {
            const dotX = parseFloat(dot.style.left);
            const dotY = parseFloat(dot.style.top);
            
            // 根据角色位置调整轨迹可见性
            const distance = Math.sqrt(Math.pow(dotX - characterX, 2) + Math.pow(dotY - characterY, 2));
            const shouldShow = distance < 300; // 只显示附近的轨迹点
            
            dot.style.display = shouldShow ? 'block' : 'none';
        });
    }
    
    // 高级轨迹预测
    predictLandingPosition(power = null) {
        const currentPower = power !== null ? power : this.state.power;
        const powerRatio = currentPower / 100;
        
        const startX = this.state.character.x + this.state.character.width / 2;
        const startY = this.state.character.y;
        
        // 物理参数
        const gravity = 0.8;
        const baseVelocity = 8;
        const maxVelocity = 20;
        const initialVelocity = baseVelocity + (maxVelocity - baseVelocity) * powerRatio;
        const angle = -Math.PI / 4;
        
        const vx = initialVelocity * Math.cos(angle);
        const vy = initialVelocity * Math.sin(angle);
        
        // 计算飞行时间
        const flightTime = (-2 * vy) / gravity;
        
        // 计算落点
        const landingX = startX + vx * flightTime;
        const landingY = startY + vy * flightTime + 0.5 * gravity * flightTime * flightTime;
        
        return {
            x: landingX,
            y: landingY,
            time: flightTime,
            velocity: { x: vx, y: vy },
            distance: vx * flightTime
        };
    }
    
    // 预测与平台的碰撞
    predictPlatformCollision(power = null) {
        const landing = this.predictLandingPosition(power);
        
        // 查找最近的平台
        let targetPlatform = null;
        let minDistance = Infinity;
        
        this.state.platforms.forEach(platform => {
            const platformCenter = platform.x + platform.width / 2;
            const distance = Math.abs(landing.x - platformCenter);
            
            if (distance < minDistance && landing.y >= platform.y - 10 && landing.y <= platform.y + 20) {
                minDistance = distance;
                targetPlatform = platform;
            }
        });
        
        if (!targetPlatform) {
            return { willHit: false, landing: landing };
        }
        
        // 计算精确的碰撞点
        const platformCenter = targetPlatform.x + targetPlatform.width / 2;
        const accuracy = 1 - (Math.abs(landing.x - platformCenter) / (targetPlatform.width / 2));
        
        return {
            willHit: true,
            landing: landing,
            platform: targetPlatform,
            accuracy: Math.max(0, accuracy),
            landingQuality: this.calculateLandingQuality(accuracy, landing.velocity)
        };
    }
    
    // 计算着陆质量
    calculateLandingQuality(accuracy, landingVelocity) {
        let quality = 'miss';
        let score = 0;
        
        if (accuracy >= 0.9) {
            quality = 'perfect';
            score = 100;
        } else if (accuracy >= 0.7) {
            quality = 'excellent';
            score = 70;
        } else if (accuracy >= 0.5) {
            quality = 'good';
            score = 40;
        } else if (accuracy >= 0.3) {
            quality = 'ok';
            score = 20;
        }
        
        // 根据着陆速度调整分数
        const speedPenalty = Math.abs(landingVelocity.y) * 2;
        score = Math.max(0, score - speedPenalty);
        
        return { quality, score, accuracy };
    }
    
    // 显示轨迹预测信息
    showTrajectoryPrediction() {
        const prediction = this.predictPlatformCollision();
        
        if (prediction.willHit) {
            const quality = prediction.landingQuality;
            const landingX = prediction.landing.x;
            const landingY = prediction.landing.y;
            
            // 创建着陆预测标记
            let landingMarker = document.getElementById('landing-prediction');
            if (!landingMarker) {
                landingMarker = document.createElement('div');
                landingMarker.id = 'landing-prediction';
                landingMarker.className = 'landing-prediction';
                document.getElementById('gameScreen').appendChild(landingMarker);
            }
            
            // 设置着陆标记样式和位置
            landingMarker.style.left = (landingX - 10) + 'px';
            landingMarker.style.top = (landingY - 10) + 'px';
            landingMarker.className = `landing-prediction ${quality.quality}`;
            
            // 显示预测质量
            const qualityText = {
                'perfect': '完美!',
                'excellent': '优秀!',
                'good': '不错!',
                'ok': '还行',
                'miss': '会错过'
            };
            
            landingMarker.textContent = qualityText[quality.quality] || '?';
            landingMarker.title = `准确度: ${Math.round(quality.accuracy * 100)}%`;
            
            landingMarker.style.display = 'block';
        } else {
            // 隐藏着陆预测
            const landingMarker = document.getElementById('landing-prediction');
            if (landingMarker) {
                landingMarker.style.display = 'none';
            }
        }
    }
    
    // 隐藏轨迹预测
    hideTrajectoryPrediction() {
        const landingMarker = document.getElementById('landing-prediction');
        if (landingMarker) {
            landingMarker.style.display = 'none';
        }
    }

    jump(e) {
        if (!this.state.isCharging || this.state.character.isJumping) return;
        
        this.state.isCharging = false;
        const power = Math.min(this.state.power, 150) / 100; // 使用最大150的蓄力值
        
        // 清除轨迹和预测
        document.getElementById('trajectory').innerHTML = '';
        document.getElementById('powerFill').style.width = '0%';
        this.hideTrajectoryPrediction();
        
        // 清除平台附着状态
        if (this.state.attachedPlatform) {
            const platformSpeed = this.state.attachedPlatform.speed || 0;
            console.log(`跳跃时继承平台速度: ${platformSpeed}`);
            
            // 继承平台的横向移动速度
            this.state.character.vx = (50 + power * 200) / 20 + platformSpeed;
            
            // 清除附着状态
            this.state.attachedPlatform = null;
            this.state.platformAttachmentOffset = 0;
        } else {
            // 正常跳跃速度
            this.state.character.vx = (50 + power * 200) / 20;
        }
        
        this.state.character.vy = -Math.sin(power * Math.PI) * 15; // 增加垂直速度范围
        this.state.character.isJumping = true;
        
        // 重置充电状态
        this.state.power = 0;
        
        // 追踪跳跃开始数据
        this.trackJumpStart();
        
        // 播放跳跃音效
        this.playSound('jumpSound');
        
        // 添加跳跃动画
        const characterEl = document.getElementById('character');
        characterEl.classList.add('jumping');
    }

    startGameLoop() {
        const gameLoop = () => {
            if (!this.state.isPlaying) return;
            
            this.updatePhysics();
            this.checkCollisions();
            this.updatePlatforms();
            this.updateCharacterPosition();
            this.updateUI();
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
    }

    updatePhysics() {
        const char = this.state.character;
        
        if (char.isJumping) {
            char.x += char.vx * this.state.gameSpeed;
            char.y += char.vy;
            char.vy += 0.8; // 重力
            
            // 追踪跳跃轨迹用于反作弊分析
            if (this.state.jumpData.trajectory.length < 50) { // 限制轨迹点数量
                this.state.jumpData.trajectory.push({
                    x: char.x,
                    y: char.y,
                    vx: char.vx,
                    vy: char.vy,
                    timestamp: Date.now()
                });
            }
            
            // 增强的失败检测机制
            this.checkGameFailureConditions();
            
            // 状态验证 - 如果速度都为0且在空中，可能是异常状态
            if (char.vx === 0 && char.vy === 0 && char.y < 400) {
                // 重置为下落状态
                char.vy = 0.1;
            }
        }
    }
    
    checkGameFailureConditions() {
        const char = this.state.character;
        const screenBottom = window.innerHeight;
        const charBottom = char.y + char.height;
        
        // 1. 水平边界检查 - 防止角色飞出边界导致状态异常
        if (char.x < -200 || char.x > window.innerWidth + 200) {
            // 角色飞出水平边界，强制结束跳跃并触发游戏结束
            char.isJumping = false;
            char.vx = 0;
            char.vy = 0;
            console.log('游戏失败：角色飞出水平边界');
            this.gameOver();
            return;
        }
        
        // 2. 垂直掉落检测 - 多种条件确保检测到所有掉落情况
        
        // 2.1 当方块完全掉出屏幕底部时结束游戏（主要检测）
        if (charBottom > screenBottom + 50) {
            console.log('游戏失败：方块完全掉出屏幕底部');
            this.gameOver();
            return;
        }
        
        // 2.2 方块掉落到屏幕左侧或右侧之外
        if (char.x + char.width < -100 || char.x > window.innerWidth + 100) {
            console.log('游戏失败：方块掉落到屏幕左右边界之外');
            this.gameOver();
            return;
        }
        
        // 2.3 方块掉落到屏幕底部（更敏感的检测）
        if (char.y > screenBottom) {
            console.log('游戏失败：方块掉落到屏幕底部');
            this.gameOver();
            return;
        }
        
        // 2.4 方块处于异常掉落状态（长时间下落且速度过大）
        if (char.vy > 15 && char.y > screenBottom * 0.8) {
            console.log('游戏失败：方块异常高速掉落');
            this.gameOver();
            return;
        }
        
        // 3. 新增：检测角色是否卡在屏幕底部边缘
        if (charBottom >= screenBottom - 10 && char.vy > 0) {
            console.log('游戏失败：角色卡在屏幕底部边缘');
            this.gameOver();
            return;
        }
        
        // 4. 新增：检测角色是否长时间处于异常位置
        if (char.y > screenBottom * 0.9 && char.vy > 5) {
            // 角色在屏幕底部90%以上位置且正在下落
            const currentTime = Date.now();
            if (!this.state.fallStartTime) {
                this.state.fallStartTime = currentTime;
            } else if (currentTime - this.state.fallStartTime > 1000) {
                // 持续下落超过1秒
                console.log('游戏失败：角色长时间异常下落');
                this.gameOver();
                return;
            }
        } else {
            // 重置下落计时
            this.state.fallStartTime = null;
        }
        
        // 5. 新增：检测角色是否超出合理的游戏区域
        if (char.y < -500) {
            // 角色飞出屏幕顶部太远
            console.log('游戏失败：角色飞出屏幕顶部太远');
            this.gameOver();
            return;
        }
        
        // 6. 新增：检测角色速度是否异常
        if (Math.abs(char.vx) > 50 || Math.abs(char.vy) > 30) {
            // 速度异常，可能是物理计算错误
            console.log('游戏失败：角色速度异常');
            this.gameOver();
            return;
        }
    }

    checkCollisions() {
        const char = this.state.character;
        let hasLanded = false;
        
        // 1. 检查底部碰撞检测线
        if (this.state.bottomCollisionLine && this.isColliding(char, this.state.bottomCollisionLine)) {
            console.log('底部碰撞检测：方块触碰到底部检测线，触发游戏失败');
            this.gameOver();
            return;
        }
        
        // 2. 处理平台附着逻辑
        if (!char.isJumping && this.state.attachedPlatform) {
            // 保持与附着平台的相对位置
            const platform = this.state.attachedPlatform;
            const targetX = platform.x + this.state.platformAttachmentOffset;
            
            // 确保同步精度在±2像素范围内
            const deltaX = targetX - char.x;
            if (Math.abs(deltaX) > 2) {
                char.x = targetX;
            }
            
            // 检查是否仍在平台范围内
            if (char.x + char.width < platform.x || char.x > platform.x + platform.width) {
                // 方块已离开平台，解除附着状态
                this.state.attachedPlatform = null;
                this.state.platformAttachmentOffset = 0;
                char.isJumping = true;
                console.log('平台附着解除：方块离开平台范围');
            }
        }
        
        // 3. 防止重复着陆检测 - 如果已经在跳跃中且vy<=0（正在上升或水平移动），不检测着陆
        if (char.isJumping && char.vy <= 0) {
            return;
        }
        
        // 4. 如果角色不在跳跃状态但还在空中，可能需要重置状态
        if (!char.isJumping && char.y < 500) {
            // 检查是否在地面上
            let onGround = false;
            for (let platform of this.state.platforms) {
                if (char.y + char.height >= platform.y - 5 && char.y + char.height <= platform.y + 5 &&
                    char.x + char.width > platform.x && char.x < platform.x + platform.width) {
                    onGround = true;
                    break;
                }
            }
            if (!onGround) {
                // 角色不在地面上但也没有跳跃状态，可能是状态错误，重置为跳跃状态
                char.isJumping = true;
                this.state.attachedPlatform = null;
                this.state.platformAttachmentOffset = 0;
            }
        }
        
        for (let platform of this.state.platforms) {
            // 确保平台有有效的碰撞属性
            if (!platform.width || !platform.height || platform.width <= 0 || platform.height <= 0) {
                continue;
            }
            
            if (this.isColliding(char, platform)) {
                if (char.vy > 0) { // 下落时
                    // 简化的着陆检测 - 只要有一点接触就算着陆成功
                    const charBottom = char.y + char.height;
                    const platformTop = platform.y;
                    const landingTolerance = 25; // 增加着陆容差，让着陆更容易
                    
                    // 只要方块底部接近平台顶部就着陆（更宽松的条件）
                    if (charBottom >= platformTop - landingTolerance && charBottom <= platformTop + landingTolerance) {
                        // 简化重叠检查 - 只要有任何重叠就算成功
                        const charLeft = char.x;
                        const charRight = char.x + char.width;
                        const platformLeft = platform.x;
                        const platformRight = platform.x + platform.width;
                        
                        // 检查是否有任何水平重叠（非常宽松的条件）
                        const hasHorizontalOverlap = charLeft < platformRight && charRight > platformLeft;
                        
                        if (hasHorizontalOverlap) {
                            // 着陆成功 - 调整方块位置到平台顶部
                            char.y = platformTop - char.height;
                            char.vx = 0;
                            char.vy = 0;
                            char.isJumping = false;
                            hasLanded = true;
                            
                            // 设置平台附着状态
                            this.state.attachedPlatform = platform;
                            this.state.platformAttachmentOffset = char.x - platform.x;
                            
                            console.log(`平台附着成功：平台速度=${platform.speed || 0}, 相对偏移=${this.state.platformAttachmentOffset}`);
                            
                            // 追踪跳跃着陆数据
                            this.trackJumpLanding(platform);
                            
                            // 检查是否完美着陆（更宽松的标准）
                            const platformCenter = platform.x + platform.width / 2;
                            const charCenter = char.x + char.width / 2;
                            const distance = Math.abs(platformCenter - charCenter);
                            const isPerfect = distance < 20; // 增加完美着陆范围，更容易获得
                            
                            if (isPerfect) {
                                this.perfectLanding();
                            } else {
                                this.state.combo = 1;
                            }
                            
                            // 基础分数 - 只保留基本分数，删除所有平台特效
                            this.state.score += 10 * this.state.combo;
                            
                            // 重要：确保着陆后不会持续触发跳跃动画
                            // 延迟一小段时间再移除跳跃类，防止动画闪烁
                            setTimeout(() => {
                                document.getElementById('character').classList.remove('jumping');
                            }, 50);
                            
                            break; // 重要：只处理第一个碰撞的平台，避免重复处理
                        }
                    }
                }
            }
        }
        
        // 如果没有着陆且方块在平台下方，检查是否需要掉落
        if (!hasLanded && char.vy >= 0) {
            this.checkFallingThroughPlatforms();
        }
    }
    
    checkFallingThroughPlatforms() {
        const char = this.state.character;
        let isAbovePlatform = false;
        
        // 检查方块是否在任何平台上方
        for (let platform of this.state.platforms) {
            const charLeft = char.x;
            const charRight = char.x + char.width;
            const charBottom = char.y + char.height;
            const platformLeft = platform.x;
            const platformRight = platform.x + platform.width;
            const platformTop = platform.y;
            
            // 检查方块是否在平台水平范围内（更宽松的范围检查）
            const horizontalOverlap = Math.max(0, Math.min(charRight, platformRight) - Math.max(charLeft, platformLeft));
            
            if (horizontalOverlap > 0) {
                // 检查方块是否在平台上方（允许少量重叠）
                if (charBottom <= platformTop + 15) {
                    isAbovePlatform = true;
                    break;
                }
            }
        }
        
        // 如果方块不在任何平台上方，且正在下落，则开始掉落
        if (!isAbovePlatform && char.vy >= 0) {
            // 让方块继续下落，自然掉出屏幕
            return true;
        }
        
        return false;
    }

    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    perfectLanding() {
        this.state.perfectCount++;
        this.state.combo = Math.min(this.state.combo + 1, 5);
        this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
        
        // 显示完美着陆效果
        const perfectText = document.getElementById('perfectText');
        perfectText.classList.add('show');
        setTimeout(() => perfectText.classList.remove('show'), 1000);
        
        // 播放音效
        this.playSound('perfectSound');
        
        // 角色动画
        const characterEl = document.getElementById('character');
        characterEl.classList.add('perfect');
        setTimeout(() => characterEl.classList.remove('perfect'), 500);
        
        // 额外分数
        this.state.score += 5 * this.state.combo;
    }

    updatePlatforms() {
        // 移动平台
        for (let platform of this.state.platforms) {
            // 基础移动（游戏世界向左移动）
            platform.x -= this.state.platformSpeed * this.state.gameSpeed;
            
            // 处理移动平台的额外移动
            if (platform.speed !== 0) {
                const currentTime = Date.now();
                const moveOffset = Math.sin(currentTime * 0.001 * platform.speed) * platform.moveRange;
                const newX = platform.originalX + moveOffset;
                
                // 确保移动平台不会移出屏幕范围太多
                if (newX > -platform.width && newX < window.innerWidth + 200) {
                    platform.x = newX;
                }
            }
            
            // 同步更新DOM元素位置，确保碰撞检测与显示同步
            const platformEl = document.getElementById(`platform-${platform.id}`);
            if (platformEl) {
                platformEl.style.left = platform.x + 'px';
            }
        }
        
        // 更新底部碰撞检测线位置（跟随屏幕滚动）
        if (this.state.bottomCollisionLine) {
            this.state.bottomCollisionLine.x = 0;
            this.state.bottomCollisionLine.width = window.innerWidth;
        }
        
        // 移除屏幕外的平台
        this.state.platforms = this.state.platforms.filter(platform => 
            platform.x + platform.width > -100
        );
        
        // 移除对应的DOM元素
        document.querySelectorAll('.platform').forEach(el => {
            const id = parseFloat(el.id.replace('platform-', ''));
            if (!this.state.platforms.find(p => p.id === id)) {
                el.remove();
            }
        });
        
        // 改进的平台生成逻辑 - 确保平台持续生成
        this.ensurePlatformsContinuity();
        
        // 增加游戏速度
        if (this.state.score > 0 && this.state.score % 100 === 0) {
            this.state.gameSpeed += 0.1;
            this.state.platformSpeed += 0.05;
        }
    }
    
    ensurePlatformsContinuity() {
        // 获取最右侧平台的X坐标
        let rightmostX = 0;
        if (this.state.platforms.length > 0) {
            rightmostX = Math.max(...this.state.platforms.map(p => p.x + p.width));
        }
        
        // 屏幕宽度
        const screenWidth = window.innerWidth;
        
        // 确保屏幕右侧有足够的平台覆盖
        const minRightCoverage = screenWidth + 200; // 屏幕右侧额外200px覆盖
        
        // 生成新平台直到覆盖足够的区域
        while (rightmostX < minRightCoverage && this.state.platforms.length < 8) {
            this.generatePlatform();
            // 重新计算最右侧位置
            if (this.state.platforms.length > 0) {
                rightmostX = Math.max(...this.state.platforms.map(p => p.x + p.width));
            }
        }
        
        // 确保至少有4个平台存在
        while (this.state.platforms.length < 4) {
            this.generatePlatform();
        }
    }

    updateCharacterPosition() {
        const char = this.state.character;
        const characterEl = document.getElementById('character');
        
        characterEl.style.left = char.x + 'px';
        characterEl.style.top = char.y + 'px';
        
        // 应用皮肤
        this.applySkin();
    }

    applySkin() {
        const characterEl = document.getElementById('character');
        const skin = this.state.skins[this.state.currentSkin];
        
        if (skin.color.startsWith('linear-gradient')) {
            characterEl.style.background = skin.color;
        } else {
            characterEl.style.backgroundColor = skin.color;
        }
    }

    updateUI() {
        document.getElementById('currentScore').textContent = this.state.score;
        document.getElementById('comboText').textContent = `连击 x${this.state.combo}`;
    }

    async gameOver() {
        this.state.isPlaying = false;
        this.playSound('gameOverSound');
        
        console.log(`游戏结束 - 分数: ${this.state.score}, 玩家: ${localStorage.getItem('jumpGamePlayerName') || '匿名玩家'}`);
        
        // 准备跳跃数据用于反作弊检测和精准判定
        const jumpData = {
            reactionTime: this.state.jumpData.reactionTime,
            positionDelta: this.state.jumpData.positionDelta,
            perfectStreak: this.state.perfectCount,
            trajectory: this.state.jumpData.trajectory,
            landingVelocity: this.state.jumpData.landingVelocity,
            landingAngle: this.state.jumpData.landingAngle,
            optimalTiming: this.state.jumpData.optimalTiming,
            actualTiming: this.state.jumpData.actualTiming,
            playerPosition: { x: this.state.character.x, y: this.state.character.y },
            targetPosition: this.getLastPlatformPosition(),
            gameEndReason: 'fall_off_screen' // 记录游戏结束原因
        };

        // 使用新系统处理游戏得分
        let result = null;
        try {
            if (this.gameSystem && typeof this.gameSystem.processGameScore === 'function') {
                result = await this.gameSystem.processGameScore(this.state.score, jumpData);
                console.log('游戏得分处理结果:', result);
            } else {
                throw new Error('游戏系统未完全初始化');
            }
        } catch (error) {
            console.error('游戏得分处理失败:', error);
            // 如果新系统失败，使用传统方法
            result = {
                success: true,
                score: this.state.score,
                ranking: { ranking: this.getRankingData() },
                antiCheat: { isCheating: false, violations: [] }
            };
        }
        
        // 处理反作弊检测结果
        if (result && result.antiCheat && result.antiCheat.isCheating) {
            this.showAntiCheatAlert(result.antiCheat);
            
            // 如果分数被拒绝，显示警告但不完全阻止游戏
            if (result.error === 'score_rejected') {
                console.warn('分数因作弊嫌疑被拒绝:', result.antiCheat.violations);
                // 可以继续游戏，但分数不会被记录
            }
        }
        
        // 更新排行榜（确保分数被记录）
        if (result && result.success !== false) {
            this.updateRanking();
            console.log('排行榜已更新');
        }
        
        // 更新玩家行为基线（如果系统可用）
        if (this.gameSystem && this.gameSystem.antiCheat && typeof this.gameSystem.antiCheat.updateBehaviorBaseline === 'function') {
            this.gameSystem.antiCheat.updateBehaviorBaseline(this.gameSystem.playerId, {
                score: this.state.score,
                avgReactionTime: this.state.jumpData.reactionTime,
                timestamp: Date.now()
            });
        }
        
        // 更新统计数据（使用新系统的结果或当前数据）
        const highScore = Math.max(parseInt(document.getElementById('highScore').textContent), this.state.score);
        const gameCount = parseInt(document.getElementById('gameCount').textContent) + 1;
        
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('gameCount').textContent = gameCount;
        
        // 显示游戏结束界面
        document.getElementById('finalScore').textContent = this.state.score;
        document.getElementById('perfectCount').textContent = this.state.perfectCount;
        document.getElementById('maxCombo').textContent = this.state.maxCombo;
        
        // 计算击败百分比（使用排行榜数据）
        let rankingData = this.getRankingData();
        
        // 如果新系统有排行榜数据，优先使用
        if (result?.ranking?.ranking && result.ranking.ranking.length > 0) {
            rankingData = result.ranking.ranking;
        } else if (this.gameSystem) {
            // 尝试从新系统获取排行榜数据
            try {
                const newSystemRanking = this.gameSystem.getRankingData();
                if (newSystemRanking && newSystemRanking.length > 0) {
                    rankingData = newSystemRanking;
                }
            } catch (error) {
                console.warn('从新系统获取排行榜数据失败，使用本地数据:', error);
            }
        }
        
        const betterPlayers = rankingData.filter(player => player.score > this.state.score).length;
        const percentage = rankingData.length > 0 ? Math.round((1 - betterPlayers / rankingData.length) * 100) : 100;
        document.getElementById('shareText').textContent = `你打败了${percentage}%的好友`;
        
        // 保存游戏数据
        this.saveGameData();
        
        // 检查是否是首次游戏且未设置昵称
        if (this.state.isFirstGame && !this.state.hasSetNickname && this.state.score > 10) {
            console.log('显示首次游戏昵称设置模态框');
            this.showFirstGameModal();
            this.state.isFirstGame = false;
        }
        
        // 更新玩家行为基线
        if (this.gameSystem && this.gameSystem.antiCheat) {
            this.gameSystem.antiCheat.updateBehaviorBaseline(this.gameSystem.playerId, {
                score: this.state.score,
                avgReactionTime: this.state.jumpData.reactionTime,
                timestamp: Date.now()
            });
        }
        
        // 延迟显示游戏结束界面，让玩家看到失败过程
        setTimeout(() => {
            console.log('显示游戏结束界面');
            this.showScreen('gameOverScreen');
        }, 1000);
    }

    playSound(soundId) {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('音效播放失败:', e));
        }
    }

    shareScore() {
        const text = `我在跳跳方块中获得了${this.state.score}分，击败了${document.getElementById('shareText').textContent.replace('你', '')}！快来挑战我吧！`;
        
        if (navigator.share) {
            navigator.share({
                title: '跳跳方块 - 我的战绩',
                text: text,
                url: window.location.href
            }).catch(err => console.log('分享失败:', err));
        } else {
            // 复制到剪贴板
            navigator.clipboard.writeText(text).then(() => {
                alert('战绩已复制到剪贴板！');
            }).catch(() => {
                alert(text);
            });
        }
    }

    getRankingData() {
        const saved = localStorage.getItem('jumpGameRanking');
        return saved ? JSON.parse(saved) : [];
    }

    updateRanking() {
        const playerName = localStorage.getItem('jumpGamePlayerName') || '匿名玩家';
        const rankingData = this.getRankingData();
        
        // 查找是否已有该玩家的记录
        const existingIndex = rankingData.findIndex(player => player.name === playerName);
        
        if (existingIndex >= 0) {
            // 更新最高分
            if (this.state.score > rankingData[existingIndex].score) {
                rankingData[existingIndex].score = this.state.score;
                rankingData[existingIndex].date = new Date().toISOString();
                console.log(`玩家 ${playerName} 更新了最高分: ${this.state.score}`);
            }
        } else {
            // 添加新记录
            rankingData.push({
                name: playerName,
                score: this.state.score,
                date: new Date().toISOString()
            });
            console.log(`新玩家 ${playerName} 加入排行榜，分数: ${this.state.score}`);
        }
        
        // 按分数排序
        rankingData.sort((a, b) => b.score - a.score);
        
        // 只保留前50名
        const top50 = rankingData.slice(0, 50);
        
        localStorage.setItem('jumpGameRanking', JSON.stringify(top50));
        
        // 同步更新到精准判断系统
        if (this.gameSystem && typeof this.gameSystem.setPlayerNickname === 'function') {
            this.gameSystem.setPlayerNickname(playerName);
        }
        
        console.log(`排行榜已更新，当前记录数: ${top50.length}`);
    }

    loadRanking() {
        const rankingData = this.getRankingData();
        const playerName = localStorage.getItem('jumpGamePlayerName') || '';
        
        document.getElementById('playerName').value = playerName;
        
        // 显示玩家排名
        const playerRank = rankingData.findIndex(player => player.name === playerName) + 1;
        document.getElementById('playerRank').textContent = playerRank > 0 ? `第${playerRank}名` : '未上榜';
        
        // 显示排行榜统计信息
        console.log(`加载排行榜 - 总记录数: ${rankingData.length}, 当前玩家: ${playerName}, 排名: ${playerRank}`);
        
        // 显示排行榜列表
        const rankingList = document.getElementById('rankingList');
        rankingList.innerHTML = '';
        
        if (rankingData.length === 0) {
            rankingList.innerHTML = '<div class="ranking-empty">暂无排行榜数据，快来成为第一个玩家吧！</div>';
            return;
        }
        
        rankingData.slice(0, 20).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            if (player.name === playerName) {
                item.classList.add('current-player');
            }
            
            // 添加排名图标
            let rankIcon = '';
            if (index === 0) rankIcon = '🥇';
            else if (index === 1) rankIcon = '🥈';
            else if (index === 2) rankIcon = '🥉';
            
            item.innerHTML = `
                <span class="ranking-rank">${rankIcon}${index + 1}</span>
                <span class="ranking-name">${player.name}</span>
                <span class="ranking-score">${player.score}分</span>
            `;
            
            rankingList.appendChild(item);
        });
        
        // 显示玩家统计
        if (playerName && rankingData.length > 0) {
            const playerData = rankingData.find(p => p.name === playerName);
            if (playerData) {
                console.log(`玩家 ${playerName} 的最高分: ${playerData.score}, 排名: ${playerRank}/${rankingData.length}`);
            }
        }
    }

    savePlayerName() {
        const name = document.getElementById('playerName').value.trim();
        if (name) {
            localStorage.setItem('jumpGamePlayerName', name);
            
            // 同步到精准判断系统
            if (this.gameSystem) {
                this.gameSystem.setPlayerNickname(name);
            }
            
            this.loadRanking();
            alert('昵称已保存！');
            
            console.log(`玩家修改昵称为: ${name}`);
        } else {
            alert('请输入有效的昵称');
        }
    }

    loadSkins() {
        const skinsList = document.getElementById('skinsList');
        skinsList.innerHTML = '';
        
        Object.entries(this.state.skins).forEach(([key, skin]) => {
            const item = document.createElement('div');
            item.className = 'skin-item';
            if (!skin.unlocked) {
                item.classList.add('locked');
            }
            if (this.state.currentSkin === key) {
                item.classList.add('selected');
            }
            
            const preview = document.createElement('div');
            preview.className = 'skin-preview';
            preview.style.background = skin.color;
            
            const name = document.createElement('div');
            name.className = 'skin-name';
            name.textContent = this.getSkinName(key);
            
            const requirement = document.createElement('div');
            requirement.className = 'skin-requirement';
            requirement.textContent = skin.unlocked ? '已解锁' : `需要${skin.requirement}分解锁`;
            
            item.appendChild(preview);
            item.appendChild(name);
            item.appendChild(requirement);
            
            if (skin.unlocked) {
                item.addEventListener('click', () => this.selectSkin(key));
            }
            
            skinsList.appendChild(item);
        });
    }

    getSkinName(key) {
        const names = {
            default: '经典方块',
            cat: '可爱猫咪',
            astronaut: '太空人',
            rainbow: '彩虹方块'
        };
        return names[key] || key;
    }

    selectSkin(skinKey) {
        this.state.currentSkin = skinKey;
        this.loadSkins();
        this.saveGameData();
    }

    // 检查皮肤解锁条件
    checkSkinUnlocks() {
        const currentScore = parseInt(document.getElementById('highScore').textContent);
        
        Object.entries(this.state.skins).forEach(([key, skin]) => {
            if (!skin.unlocked && currentScore >= skin.requirement) {
                skin.unlocked = true;
                
                // 显示解锁提示
                setTimeout(() => {
                    alert(`恭喜！你解锁了新皮肤：${this.getSkinName(key)}！`);
                }, 500);
            }
        });
    }

    // 新增系统方法
    getLastPlatformPosition() {
        if (this.state.platforms.length === 0) return { x: 0, y: 0 };
        const lastPlatform = this.state.platforms[this.state.platforms.length - 1];
        return {
            x: lastPlatform.x + lastPlatform.width / 2,
            y: lastPlatform.y
        };
    }

    showFirstGameModal() {
        const modal = document.getElementById('firstGameModal');
        const nicknameInput = document.getElementById('firstNickname');
        const suggestions = document.getElementById('nicknameSuggestions');
        
        // 生成昵称建议
        const suggestionsList = this.gameSystem && typeof this.gameSystem.getNicknameSuggestions === 'function' ? 
            this.gameSystem.getNicknameSuggestions() : 
            ['跳跃者', '方块英雄', '平台大师', '跳跃新手', '游戏达人'];
        suggestions.innerHTML = '';
        
        suggestionsList.forEach(nickname => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = nickname;
            btn.addEventListener('click', (e) => this.selectNicknameSuggestion(e));
            suggestions.appendChild(btn);
        });
        
        modal.style.display = 'flex';
        nicknameInput.focus();
    }

    selectNicknameSuggestion(e) {
        const nickname = e.target.textContent;
        document.getElementById('firstNickname').value = nickname;
    }

    saveFirstNickname() {
        const nickname = document.getElementById('firstNickname').value.trim();
        if (nickname) {
            localStorage.setItem('jumpGamePlayerName', nickname);
            this.state.hasSetNickname = true;
            this.saveGameData();
            
            // 同步到精准判断系统
            if (this.gameSystem && typeof this.gameSystem.setPlayerNickname === 'function') {
                this.gameSystem.setPlayerNickname(nickname);
            }
            
            // 记录转换成功
            if (this.gameSystem && typeof this.gameSystem.recordNicknameConversion === 'function') {
                this.gameSystem.recordNicknameConversion(true);
            }
            
            document.getElementById('firstGameModal').style.display = 'none';
            alert(`欢迎，${nickname}！继续挑战更高分数吧！`);
            
            console.log(`首次昵称设置成功: ${nickname}`);
        } else {
            alert('请输入一个昵称');
        }
    }

    skipFirstNickname() {
        this.state.hasSetNickname = false;
        this.saveGameData();
        
        // 记录转换失败
        if (this.gameSystem && typeof this.gameSystem.recordNicknameConversion === 'function') {
            this.gameSystem.recordNicknameConversion(false);
        }
        
        document.getElementById('firstGameModal').style.display = 'none';
    }

    showAntiCheatAlert(antiCheatResult) {
        const alert = document.getElementById('antiCheatAlert');
        const violations = document.getElementById('antiCheatViolations');
        const progress = document.getElementById('antiCheatProgress');
        
        // 显示违规行为
        violations.innerHTML = '';
        antiCheatResult.violations.forEach(violation => {
            const item = document.createElement('div');
            item.className = 'violation-item';
            item.textContent = this.gameSystem && typeof this.gameSystem.getViolationDescription === 'function' ? 
                this.gameSystem.getViolationDescription(violation.type) : 
                `违规行为: ${violation.type}`;
            violations.appendChild(item);
        });
        
        // 显示风险等级
        const riskLevel = antiCheatResult.riskLevel;
        alert.className = `anti-cheat-alert ${riskLevel}`;
        
        // 显示进度条
        progress.style.width = `${antiCheatResult.riskScore}%`;
        
        // 显示警告
        alert.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            alert.style.display = 'none';
        }, 3000);
    }

    changeLanguage(e) {
        const language = e.target.value;
        this.gameSystem.setLanguage(language);
        this.updateLanguageDisplay();
    }

    updateLanguageDisplay() {
        // 更新界面文本
        const translations = this.gameSystem && typeof this.gameSystem.getCurrentTranslations === 'function' ? 
            this.gameSystem.getCurrentTranslations() : 
            {
                start_game: '开始游戏',
                ranking: '排行榜',
                skins: '皮肤',
                game_over: '游戏结束',
                play_again: '再玩一次',
                back_home: '返回首页',
                share: '分享战绩'
            };
        
        // 更新按钮文本
        document.getElementById('startBtn').textContent = translations.start_game || '开始游戏';
        document.getElementById('rankingBtn').textContent = translations.ranking || '排行榜';
        document.getElementById('skinsBtn').textContent = translations.skins || '皮肤';
        
        // 更新游戏结束界面
        document.querySelector('#gameOverScreen h2').textContent = translations.game_over || '游戏结束';
        document.getElementById('playAgainBtn').textContent = translations.play_again || '再玩一次';
        document.getElementById('backHomeBtn').textContent = translations.back_home || '返回首页';
        document.getElementById('shareBtn').textContent = translations.share || '分享战绩';
        
        // 更新其他界面元素...
        this.updateSystemStatus();
    }

    initializeLanguageSelector() {
        const selector = document.getElementById('languageSelect');
        const savedLang = localStorage.getItem('jumpGameLanguage') || 'zh';
        selector.value = savedLang;
        this.gameSystem.setLanguage(savedLang);
        this.updateLanguageDisplay();
    }

    updateSystemStatus() {
        const statusBar = document.getElementById('systemStatus');
        const storageHealth = document.getElementById('storageHealth');
        const antiCheatStatus = document.getElementById('antiCheatStatus');
        
        // 检查元素是否存在
        if (!statusBar || !storageHealth || !antiCheatStatus) {
            console.log('系统状态栏元素未找到，跳过状态更新');
            return;
        }
        
        // 获取存储系统健康状态
        try {
            if (this.gameSystem && this.gameSystem.dualStorage && typeof this.gameSystem.dualStorage.getHealthStatus === 'function') {
                const health = this.gameSystem.dualStorage.getHealthStatus();
                storageHealth.className = `status-indicator ${health.status}`;
                storageHealth.title = health.message;
            } else {
                storageHealth.className = 'status-indicator healthy';
                storageHealth.title = '存储系统正常';
            }
        } catch (error) {
            storageHealth.className = 'status-indicator healthy';
            storageHealth.title = '存储系统正常';
        }
        
        // 获取反作弊系统状态
        try {
            if (this.gameSystem && this.gameSystem.antiCheat && typeof this.gameSystem.antiCheat.getSystemHealth === 'function') {
                const antiCheatHealth = this.gameSystem.antiCheat.getSystemHealth();
                antiCheatStatus.className = `status-indicator ${antiCheatHealth.status}`;
                antiCheatStatus.title = antiCheatHealth.message;
            } else {
                antiCheatStatus.className = 'status-indicator healthy';
                antiCheatStatus.title = '反作弊系统正常';
            }
        } catch (error) {
            antiCheatStatus.className = 'status-indicator healthy';
            antiCheatStatus.title = '反作弊系统正常';
        }
        
        // 显示/隐藏状态栏
        const storageStatus = storageHealth.classList.contains('healthy') ? 'healthy' : 'warning';
        const antiCheatStatusClass = antiCheatStatus.classList.contains('healthy') ? 'healthy' : 'warning';
        
        if (storageStatus !== 'healthy' || antiCheatStatusClass !== 'healthy') {
            statusBar.style.display = 'flex';
        } else {
            statusBar.style.display = 'none';
        }
    }

    dismissStorageWarning() {
        document.getElementById('storageWarning').style.display = 'none';
        // 记录用户忽略警告
        if (this.gameSystem && typeof this.gameSystem.recordUserAction === 'function') {
            this.gameSystem.recordUserAction('dismiss_storage_warning');
        }
    }

    // 增强跳跃追踪
    trackJumpStart() {
        this.state.jumpData.reactionTime = Date.now() - this.state.lastJumpTime;
        this.state.jumpData.trajectory = [];
        this.state.gameStartTime = this.state.gameStartTime || Date.now();
    }

    trackJumpLanding(platform) {
        const char = this.state.character;
        const platformCenter = platform.x + platform.width / 2;
        const charCenter = char.x + char.width / 2;
        
        this.state.jumpData.positionDelta = Math.abs(platformCenter - charCenter);
        this.state.jumpData.landingVelocity = { x: char.vx, y: char.vy };
        this.state.jumpData.landingAngle = Math.atan2(char.vy, char.vx);
        this.state.jumpData.actualTiming = Date.now() - this.state.gameStartTime;
        this.state.lastJumpTime = Date.now();
        
        // 记录轨迹点用于反作弊分析
        this.state.jumpData.trajectory.push({
            x: char.x,
            y: char.y,
            vx: char.vx,
            vy: char.vy,
            timestamp: Date.now()
        });
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new JumpGame();
    
    // 定期检查皮肤解锁
    setInterval(() => {
        game.checkSkinUnlocks();
    }, 1000);
    
    // 定期更新系统状态（每30秒）
    setInterval(() => {
        game.updateSystemStatus();
    }, 30000);
    
    // 监听存储系统变化
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.includes('jumpGame')) {
            game.updateSystemStatus();
        }
    });
    
    // 监听页面可见性变化，优化性能
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 页面隐藏时暂停一些监控
            if (game.gameSystem && typeof game.gameSystem.pauseMonitoring === 'function') {
                game.gameSystem.pauseMonitoring();
            }
        } else {
            // 页面显示时恢复监控
            if (game.gameSystem && typeof game.gameSystem.resumeMonitoring === 'function') {
                game.gameSystem.resumeMonitoring();
            }
            game.updateSystemStatus();
        }
    });
    
    // 添加测试功能到全局作用域
    window.gameTest = {
        // 测试游戏失败检测
        testGameFailure: function(testType = 'all') {
            if (!game.state.isPlaying) {
                console.warn('请先开始游戏再测试失败检测');
                return;
            }
            
            console.log(`开始测试游戏失败检测: ${testType}`);
            
            switch(testType) {
                case 'fall_bottom':
                    // 测试掉落到屏幕底部
                    game.state.character.y = window.innerHeight + 100;
                    game.state.character.vy = 10;
                    console.log('测试：角色掉落到屏幕底部');
                    break;
                    
                case 'fall_left':
                    // 测试掉落到屏幕左侧
                    game.state.character.x = -300;
                    game.state.character.vx = -20;
                    console.log('测试：角色掉落到屏幕左侧');
                    break;
                    
                case 'fall_right':
                    // 测试掉落到屏幕右侧
                    game.state.character.x = window.innerWidth + 300;
                    game.state.character.vx = 20;
                    console.log('测试：角色掉落到屏幕右侧');
                    break;
                    
                case 'high_speed':
                    // 测试高速掉落
                    game.state.character.y = window.innerHeight * 0.8;
                    game.state.character.vy = 20;
                    console.log('测试：角色高速掉落');
                    break;
                    
                case 'stuck_bottom':
                    // 测试卡在底部
                    game.state.character.y = window.innerHeight - 5;
                    game.state.character.vy = 2;
                    console.log('测试：角色卡在屏幕底部');
                    break;
                    
                case 'all':
                    // 依次测试所有情况
                    console.log('=== 开始全面测试游戏失败检测 ===');
                    setTimeout(() => this.testGameFailure('fall_bottom'), 1000);
                    setTimeout(() => this.testGameFailure('fall_left'), 3000);
                    setTimeout(() => this.testGameFailure('fall_right'), 5000);
                    setTimeout(() => this.testGameFailure('high_speed'), 7000);
                    setTimeout(() => this.testGameFailure('stuck_bottom'), 9000);
                    setTimeout(() => console.log('=== 游戏失败检测测试完成 ==='), 11000);
                    break;
                    
                default:
                    console.warn('未知的测试类型:', testType);
                    console.log('可用测试类型: fall_bottom, fall_left, fall_right, high_speed, stuck_bottom, all');
            }
        },
        
        // 测试昵称设置功能
        testNickname: function() {
            const testNames = ['测试玩家', 'GameTester', '测试昵称'];
            const randomName = testNames[Math.floor(Math.random() * testNames.length)];
            
            console.log('测试昵称设置:', randomName);
            localStorage.setItem('jumpGamePlayerName', randomName);
            
            // 同步到精准判断系统
            if (game.gameSystem) {
                game.gameSystem.setPlayerNickname(randomName);
            }
            
            console.log('昵称设置完成:', randomName);
            console.log('当前昵称:', localStorage.getItem('jumpGamePlayerName'));
            
            return randomName;
        },
        
        // 测试排行榜功能
        testRanking: function() {
            console.log('=== 测试排行榜功能 ===');
            
            // 获取当前排行榜数据
            const currentRanking = game.getRankingData();
            console.log('当前排行榜记录数:', currentRanking.length);
            
            // 测试添加分数到排行榜
            const testScore = Math.floor(Math.random() * 1000) + 100;
            const playerName = localStorage.getItem('jumpGamePlayerName') || '测试玩家';
            
            console.log('添加测试分数:', testScore, '玩家:', playerName);
            
            // 模拟游戏结束流程
            game.state.score = testScore;
            game.updateRanking();
            
            // 显示更新后的排行榜
            setTimeout(() => {
                const updatedRanking = game.getRankingData();
                console.log('更新后排行榜记录数:', updatedRanking.length);
                
                // 查找玩家排名
                const playerRank = updatedRanking.findIndex(p => p.name === playerName) + 1;
                console.log('玩家排名:', playerRank > 0 ? `第${playerRank}名` : '未上榜');
                
                console.log('=== 排行榜测试完成 ===');
            }, 500);
            
            return testScore;
        },
        
        // 显示当前游戏状态
        showStatus: function() {
            console.log('=== 当前游戏状态 ===');
            console.log('游戏状态:', game.state.isPlaying ? '进行中' : '已停止');
            console.log('当前分数:', game.state.score);
            console.log('玩家昵称:', localStorage.getItem('jumpGamePlayerName') || '未设置');
            console.log('游戏次数:', localStorage.getItem('jumpGameData') ? JSON.parse(localStorage.getItem('jumpGameData')).gameCount || 0 : 0);
            console.log('最高分数:', document.getElementById('highScore').textContent);
            
            // 排行榜状态
            const rankingData = game.getRankingData();
            console.log('排行榜记录数:', rankingData.length);
            
            // 存储系统状态
            if (game.gameSystem && game.gameSystem.dualStorage) {
                const health = game.gameSystem.dualStorage.getHealthStatus();
                console.log('存储系统状态:', health.message);
            }
            
            console.log('=== 状态显示完成 ===');
        }
    };
    
    console.log('游戏测试功能已加载！可用命令:');
    console.log('- gameTest.testGameFailure(type) - 测试游戏失败检测');
    console.log('- gameTest.testNickname() - 测试昵称设置');
    console.log('- gameTest.testRanking() - 测试排行榜功能');
    console.log('- gameTest.showStatus() - 显示当前游戏状态');
    console.log('测试类型: fall_bottom, fall_left, fall_right, high_speed, stuck_bottom, all');
});