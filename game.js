// game.js
class GoalieClicker {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Конфигурация
        this.FPS = 60;
        this.PUCK_RADIUS = 14;
        this.START_LIVES = 1;
        this.MAX_SPEED_MULT = 3;
        this.SPEED_RAMP_TIME = 40.0;

        // 🟢 Новый параметр — масштаб спрайта букета
        this.BOUQUET_SCALE = 0.5;

        // 🧍 Настройки персонажа
        this.MAN_X = 0.63;        // положение по ширине (0..1)
        this.MAN_Y = 0.6;       // положение по высоте (0..1)
        this.MAN_SCALE = 0.6;    // масштаб персонажа
        this.MAN_SWITCH_SPEED = 0.5; // скорость смены кадров (в секундах)
        this.manTimer = 0;
        this.manFrame = 0; // 0 - man_1, 1 - man_2

        // 👩 Настройки персонажа-женщины
        this.WOMAN_X = 0.42;        // положение по ширине (0..1)
        this.WOMAN_Y = 0.6;       // положение по высоте (0..1)
        this.WOMAN_SCALE = 0.65;    // масштаб персонажа
        this.WOMAN_SWITCH_SPEED = 0.6; // скорость смены кадров (в секундах)
        this.womanTimer = 0;
        this.womanFrame = 0; // 0 - woman_1, 1 - woman_2

        this.confetti = [];
        this.gameOverFade = 0; // прозрачность затемнения
        this.inviteVisible = false;

        // Состояние игры
        this.debugMode = false;
        this.infiniteLives = false;
        this.muted = false;
        this.isMobile = this.detectMobile();
        
        // Позиция курсора для отладки
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseInGameArea = false;
        
        // Система задержки звука сейва
        this.saveSoundCooldown = 0;
        this.saveSoundEnabled = true;
        
        // Линии отладки
        this.debugLines = {
            vertical: [],
            horizontal: []
        };
        this.showDebugLines = false;
        this.lineEditingMode = null;
        
        // Background система
        this.bgRect = { x: 0, y: 0, width: 0, height: 0 };
        this.bgScale = 1;
        
        // Конфигурация относительно background
        this.config = {
            "bg": {
                "path": "background.png",
                "width": 1024,
                "height": 1470,
                "aspectRatio": 1024/1470
            },
            "goalieL": {
                "img": "keepL.png",
                "x_rel": 0.1,
                "y_rel": 0.68,
                "scale": 0.57
            },
            "goalieR": {
                "img": "keepR.png", 
                "x_rel": 0.65,
                "y_rel": 0.68,
                "scale": 0.57
            },
            "spawns": [
                {
                    "x_rel": 0.233,
                    "y_rel": 0.1
                },
                {
                    "x_rel": 0.76,
                    "y_rel": 0.1
                }
            ],
            "targets": [
                {
                    "x_rel": 0.233,
                    "y_rel": 1.0
                },
                {
                    "x_rel": 0.76,
                    "y_rel": 1.0
                }
            ],
            "line": {
                "y_rel": 0.8
            }
        };
        
        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadAssets();
        this.resetGameState();
        this.setupUI();
        this.gameLoop();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const gameArea = document.querySelector('.game-area');
        
        if (gameArea) {
            const rect = gameArea.getBoundingClientRect();
            
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.canvas.style.left = rect.left + 'px';
            this.canvas.style.top = rect.top + 'px';

            this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
            this.canvas.height = Math.max(1, Math.round(rect.height * dpr));

            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        this.computeGameRect();
        this.updateUIElements();
    }

    computeGameRect() {
        const gameArea = document.querySelector('.game-area');
        if (!gameArea) {
            this.gameRect = { x: 0, y: 0, width: 412, height: 892 };
            return;
        }

        const rect = gameArea.getBoundingClientRect();
        
        const bgAspect = this.config.bg.aspectRatio;
        const containerAspect = rect.width / rect.height;
        
        if (containerAspect > bgAspect) {
            this.bgRect.height = rect.height;
            this.bgRect.width = rect.height * bgAspect;
            this.bgRect.x = (rect.width - this.bgRect.width) / 2;
            this.bgRect.y = 0;
        } else {
            this.bgRect.width = rect.width;
            this.bgRect.height = rect.width / bgAspect;
            this.bgRect.x = 0;
            this.bgRect.y = (rect.height - this.bgRect.height) / 2;
        }
        
        this.bgScale = this.bgRect.width / this.config.bg.width;
        
        this.gameRect = {
            x: this.bgRect.x,
            y: this.bgRect.y,
            width: this.bgRect.width,
            height: this.bgRect.height
        };
        
        this.setupSpawnsAndTargets();
    }

    updateUIElements() {
        const goalElement = document.getElementById('goalText');
        if (goalElement) {
            goalElement.style.left = '50%';
            goalElement.style.top = '20%';
            goalElement.style.transform = 'translate(-50%, -20%)';
        }
    }

    async loadAssets() {
        this.assets = {};
        this.bg2Loaded = false; // Флаг загрузки второго фона
        await this.loadImages();
        await this.loadSounds();
    }

    loadImages() {
        return new Promise((resolve) => {
            const imagesToLoad = [
                { key: 'bg', path: this.config.bg.path },
                { key: 'bg2', path: 'background_2.png' }, // Добавляем второй фон
                { key: 'goalieL', path: this.config.goalieL.img },
                { key: 'goalieR', path: this.config.goalieR.img },
                { key: 'bouquet', path: 'bouquet.png' },
                { key: 'man1', path: 'man_1.png' },
                { key: 'man2', path: 'man_2.png' },
                { key: 'woman1', path: 'woman_1.png' },
                { key: 'woman2', path: 'woman_2.png' },
                { key: 'invite', path: 'invite.png' }
            ];
            let loadedCount = 0;
            const totalToLoad = imagesToLoad.length;

            imagesToLoad.forEach(img => {
                this.assets[img.key] = new Image();
                this.assets[img.key].onload = () => {
                    loadedCount++;
                    if (img.key === 'bg2') this.bg2Loaded = true;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].onerror = () => {
                    console.warn(`Не удалось загрузить изображение: ${img.path}`);
                    loadedCount++;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].src = `assets/${img.path}`;
            });
        });
    }

    async loadSounds() {
        this.sounds = {};
        const soundsToLoad = [
            { key: 'background', path: 'game.mp3' },
            { key: 'save', path: 'save.mp3' },
            { key: 'miss', path: 'miss.mp3' }
        ];

        for (const sound of soundsToLoad) {
            try {
                const audio = new Audio();
                audio.src = `assets/${sound.path}`;
                audio.preload = 'auto';
                audio.loop = sound.key === 'background'; // Зацикливаем фоновую музыку
                this.sounds[sound.key] = audio;
                await audio.load();
            } catch (error) {
                console.warn(`Не удалось загрузить звук: ${sound.path}`, error);
            }
        }
    }

    setupEventListeners() {
        const canvas = this.canvas;
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        canvas.addEventListener('click', (e) => this.handleClick(e));
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));

        document.addEventListener('keydown', (e) => this.handleKey(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    resetGameState() {
        this.score = 0;
        this.lives = this.START_LIVES;
        this.speedMult = 1.0;
        this.elapsed = 0;
        this.pucks = [];
        this.spawnTimer = 0;
        this.lineY = this.config.line.y_rel * this.bgRect.height;
        this.gameOver = false;
        this.playing = false;
        this.startDelay = 1.0;
        this.spawnDelay = 0.0;
        this.goalieL = this.createGoalie("L");
        this.goalieR = this.createGoalie("R");
        this.currentGoalie = this.goalieL;
        this.updateLivesDisplay();
        this.updateScoreDisplay();
    }

	setupUI() {
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');

    if (startButton) {
        // 🟢 Блокируем кнопку при первом запуске
        startButton.disabled = true;
        startButton.style.opacity = '0.5';
        startButton.style.cursor = 'not-allowed';
        
        // Разблокируем через 3 секунды
        setTimeout(() => {
            startButton.disabled = false;
            startButton.style.opacity = '1';
            startButton.style.cursor = 'pointer';
        }, 3000);
        
        startButton.addEventListener('click', () => this.startGame());
    }
    
    if (restartButton) {
        restartButton.addEventListener('click', () => this.startGame());
    }
}

    createGoalie(side) {
        const conf = this.config[side === "L" ? "goalieL" : "goalieR"];
        const img = this.assets[side === "L" ? "goalieL" : "goalieR"];

        return {
            side: side,
            conf: conf,
            img: img,
            x: conf.x_rel * this.bgRect.width,
            y: conf.y_rel * this.bgRect.height,
            w: img ? img.width * conf.scale * this.bgScale : 0,
            h: img ? img.height * conf.scale * this.bgScale : 0
        };
    }

    setupSpawnsAndTargets() {
        this.spawns = this.config.spawns.map(s => ({
            x: s.x_rel * this.bgRect.width,
            y: s.y_rel * this.bgRect.height
        }));

        this.targets = this.config.targets.map(t => ({
            x: t.x_rel * this.bgRect.width,
            y: t.y_rel * this.bgRect.height
        }));
    }

    startGame() {
        this.resetGameState();
        this.playing = true;
        this.elapsed = 0;
        this.speedMult = 1.0;
        this.pucks = [];
        this.spawnTimer = 0;
        this.inviteVisible = false;
        this.gameOverFade = 0;
        this.hideUI();
        this.playBackgroundMusic();
    }

    playBackgroundMusic() {
        if (this.sounds.background && !this.muted) {
            this.sounds.background.currentTime = 0;
            this.sounds.background.play().catch(e => {
                console.log('Автовоспроизведение заблокировано, требуется пользовательское взаимодействие');
            });
        }
    }

    stopBackgroundMusic() {
        if (this.sounds.background) {
            this.sounds.background.pause();
            this.sounds.background.currentTime = 0;
        }
    }

    hideUI() {
        document.getElementById('startScreen')?.classList.add('hidden');
        document.getElementById('gameOverScreen')?.classList.add('hidden');
        // HUD полностью удален, поэтому ничего не показываем
    }

    handleKey(e) {
        if (e.code === 'KeyD') {
            this.debugMode = !this.debugMode;
        }
        if (e.code === 'KeyM') {
            this.toggleMute();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        
        // Применяем mute ко всем звукам
        Object.values(this.sounds).forEach(sound => {
            sound.muted = this.muted;
        });
        
        if (this.muted) {
            this.stopBackgroundMusic();
        } else if (this.playing && !this.inviteVisible) {
            this.playBackgroundMusic();
        }
    }

    handleKeyUp(e) {}

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.mouseInGameArea = true;
    }

    handleMouseLeave() {
        this.mouseInGameArea = false;
    }

    handleClick(e) {
        if (this.inviteVisible) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const btnWidth = 300 * this.bgScale;
            const btnHeight = 80 * this.bgScale;
            const btnX = this.bgRect.x + (this.bgRect.width - btnWidth) / 2;
            const btnY = this.bgRect.y + this.bgRect.height * 0.85;
            
            if (x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight) {
                this.startGame();
                this.inviteVisible = false;
                return;
            }
        }
        
        if (!this.playing) return;
        this.toggleGoalie();
    }

    handleTouchStart(e) {
        e.preventDefault();
        
        // Обработка касания для кнопки "Играть еще раз" на мобильных
        if (this.inviteVisible) {
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            const btnWidth = 300 * this.bgScale;
            const btnHeight = 80 * this.bgScale;
            const btnX = this.bgRect.x + (this.bgRect.width - btnWidth) / 2;
            const btnY = this.bgRect.y + this.bgRect.height * 0.87;
            
            if (x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight) {
                this.startGame();
                this.inviteVisible = false;
                return;
            }
        }
        
        if (!this.playing) return;
        this.toggleGoalie();
    }

    toggleGoalie() {
        this.currentGoalie = this.currentGoalie === this.goalieL ? this.goalieR : this.goalieL;
    }

    gameLoop() {
        const now = performance.now();
        const dt = (now - (this.lastTime || now)) / 1000;
        this.lastTime = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update(dt) {
        if (this.inviteVisible) {
            this.gameOverFade = Math.min(1, this.gameOverFade + dt / 1.5);
            this.updateConfetti(dt);
            return;
        }
        
        if (!this.playing) return;

        this.elapsed += dt;
        this.speedMult = 1.0 + Math.min(1.0, this.elapsed / this.SPEED_RAMP_TIME) * (this.MAX_SPEED_MULT - 1.0);
        this.spawnTimer += dt;

        // 🟢 Новый букет спавним только если нет активных
        if (this.pucks.length === 0 && this.spawnTimer >= 0.5) {
            this.spawnTimer = 0;
            this.spawnPuck();
        }

        for (let i = this.pucks.length - 1; i >= 0; i--) {
            const puck = this.pucks[i];
            puck.update(dt);

            if (puck.y >= this.lineY && !puck.fade) {
                if (this.checkSave(puck)) {
                    puck.fade = true;
                    this.score++;
                    this.updateScoreDisplay();
                    this.playSound('save');
                } else {
                    puck.fade = true;
                    this.lives--;
                    this.updateLivesDisplay();
                    this.playSound('miss');
                    if (this.lives <= 0) {
                        this.endGame();
                    }
                }
            }

            if (!puck.alive) {
                this.pucks.splice(i, 1);
            }
        }   
        
        // 🟢 Переключение кадров персонажа
        this.manTimer += dt;
        if (this.manTimer >= this.MAN_SWITCH_SPEED) {
            this.manTimer = 0;
            this.manFrame = this.manFrame === 0 ? 1 : 0;
        }
        
        // 🟢 Переключение кадров женщины
        this.womanTimer += dt;
        if (this.womanTimer >= this.WOMAN_SWITCH_SPEED) {
            this.womanTimer = 0;
            this.womanFrame = this.womanFrame === 0 ? 1 : 0;
        }
    }

    playSound(soundKey) {
        if (this.sounds[soundKey] && !this.muted) {
            const sound = this.sounds[soundKey].cloneNode();
            sound.volume = 0.7;
            sound.play().catch(e => console.log('Не удалось воспроизвести звук:', e));
        }
    }

    checkSave(puck) {
        const goalie = this.currentGoalie;
        return (
            puck.x >= goalie.x &&
            puck.x <= goalie.x + goalie.w &&
            puck.y >= goalie.y &&
            puck.y <= goalie.y + goalie.h
        );
    }

    spawnPuck() {
        // 🟢 Изменено — вертикальный полёт и случайный поворот ±15°
        const spawnIndex = Math.floor(Math.random() * this.spawns.length);
        const spawn = this.spawns[spawnIndex];
        const target = this.targets[spawnIndex];

        const baseSpeed = (260 + Math.random() * 100) * this.speedMult;
        const rotation = (Math.random() < 0.5 ? -1 : 1) * 15 * Math.PI / 180;

        this.pucks.push(
            new Puck(
                spawn.x,
                spawn.y,
                target.x,
                target.y,
                baseSpeed,
                this.PUCK_RADIUS * this.bgScale,
                rotation // 🟢 передаём угол
            )
        );
    }

    endGame() {
        this.playing = false;
        this.inviteVisible = true;
        this.gameOverFade = 0;
        this.createConfetti();
    }

    createConfetti() {
        this.confetti = [];
        for (let i = 0; i < 100; i++) {
            this.confetti.push({
                x: Math.random() * this.bgRect.width,
                y: Math.random() * -this.bgRect.height,
                size: 4 + Math.random() * 4,
                color: `hsl(${Math.random() * 360}, 100%, 60%)`,
                speedY: 50 + Math.random() * 150,
                speedX: -50 + Math.random() * 100,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    updateConfetti(dt) {
        for (const c of this.confetti) {
            c.y += c.speedY * dt;
            c.x += c.speedX * dt;
            c.rotation += c.rotationSpeed;

            if (c.y > this.bgRect.height + 50) {
                c.y = -10;
                c.x = Math.random() * this.bgRect.width;
            }
        }
    }

    updateScoreDisplay() {
        // Обновляем только счет в canvas, HUD больше не существует
    }

    updateLivesDisplay() {
        // Жизни больше не отображаются
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 🌙 Если игра закончилась — рисуем финальный экран
        if (this.inviteVisible) {
            this.renderGameOverScreen(ctx);
            return; // Прерываем обычную отрисовку игры
        }

        // Фон
        if (this.assets.bg?.complete) {
            ctx.drawImage(this.assets.bg, this.bgRect.x, this.bgRect.y, this.bgRect.width, this.bgRect.height);
        }

        // Счёт в середине сверху (отображается всегда)
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(70 * this.bgScale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`${this.score}`, this.bgRect.x + this.bgRect.width / 2, this.bgRect.y + 100 * this.bgScale);
        ctx.restore();

        // 🧍 Рисуем персонажа
        const manImg = this.manFrame === 0 ? this.assets.man1 : this.assets.man2;
        if (manImg && manImg.complete) {
            const scale = this.MAN_SCALE * this.bgScale;
            const w = manImg.width * scale;
            const h = manImg.height * scale;
            const x = this.bgRect.x + this.bgRect.width * this.MAN_X - w / 2;
            const y = this.bgRect.y + this.bgRect.height * this.MAN_Y - h / 2;
            ctx.drawImage(manImg, x, y, w, h);
        }

        // 👩 Рисуем женщину
        const womanImg = this.womanFrame === 0 ? this.assets.woman1 : this.assets.woman2;
        if (womanImg && womanImg.complete) {
            const scale = this.WOMAN_SCALE * this.bgScale;
            const w = womanImg.width * scale;
            const h = womanImg.height * scale;
            const x = this.bgRect.x + this.bgRect.width * this.WOMAN_X - w / 2;
            const y = this.bgRect.y + this.bgRect.height * this.WOMAN_Y - h / 2;
            ctx.drawImage(womanImg, x, y, w, h);
        }

        // Букеты
        for (const puck of this.pucks) {
            puck.draw(ctx, this.bgRect);
        }

        // Вратари
        this.drawGoalie(this.currentGoalie);
    }

	renderGameOverScreen(ctx) {
    ctx.save();
    ctx.globalAlpha = this.gameOverFade * 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Конфетти
    for (const c of this.confetti) {
        ctx.save();
        ctx.fillStyle = c.color;
        ctx.translate(this.bgRect.x + c.x, this.bgRect.y + c.y);
        ctx.rotate(c.rotation);
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();
    }

    // Используем background_2 если он загружен
    if (this.bg2Loaded && this.assets.bg2?.complete) {
        ctx.save();
        ctx.globalAlpha = this.gameOverFade;
        ctx.drawImage(this.assets.bg2, this.bgRect.x, this.bgRect.y, this.bgRect.width, this.bgRect.height);
        ctx.restore();
    }

    // Текст приглашения с черной обводкой
    ctx.save();
    ctx.globalAlpha = this.gameOverFade;
    ctx.font = `bold ${Math.round(70 * this.bgScale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Разбиваем текст на строки для лучшего отображения
    const lines = [
        "Друзья, приглашаем Вас",
        "на нашу свадьбу!",
        "Ваши Иван и Василиса!"
    ];

    const lineHeight = 80 * this.bgScale;
    const startY = this.bgRect.y + this.bgRect.height * 0.2;

    lines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        const x = this.bgRect.x + this.bgRect.width / 2;
        
        // Рисуем черную обводку
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 7 * this.bgScale; // Толщина обводки
        ctx.strokeText(line, x, y);
        
        // Рисуем белый текст поверх
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line, x, y);
    });
    ctx.restore();

 // Счет игры с черной обводкой (над кнопкой)
    ctx.save();
    ctx.globalAlpha = this.gameOverFade;
    ctx.font = `bold ${Math.round(28 * this.bgScale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const scoreText = `Ваш результат: ${this.score} очков`;
    const scoreX = this.bgRect.x + this.bgRect.width / 2;
    const scoreY = this.bgRect.y + this.bgRect.height * 0.8;
    
    // Черная обводка для счета
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3 * this.bgScale;
    ctx.strokeText(scoreText, scoreX, scoreY);
    
    // Белый текст счета
    ctx.fillStyle = '#ffffff';
    ctx.fillText(scoreText, scoreX, scoreY);
    ctx.restore();

    // Кнопка "Играть еще раз" с закругленными углами
    const btnWidth = 300 * this.bgScale;
    const btnHeight = 80 * this.bgScale;
    const btnX = this.bgRect.x + (this.bgRect.width - btnWidth) / 2;
    const btnY = this.bgRect.y + this.bgRect.height * 0.87;
    const borderRadius = 20 * this.bgScale; // Радиус закругления
    
    ctx.save();
    ctx.globalAlpha = this.gameOverFade;
    
    // Рисуем кнопку с закругленными углами
    ctx.fillStyle = '#ffffff';
    this.drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, borderRadius);
    ctx.fill();
    
    // Текст кнопки
    ctx.fillStyle = '#000';
    ctx.font = `${Math.round(36 * this.bgScale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Играть еще раз', btnX + btnWidth / 2, btnY + btnHeight / 2);
    
    ctx.restore();
}

// Вспомогательный метод для рисования прямоугольника с закругленными углами
drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

    drawGoalie(goalie) {
        if (!goalie.img?.complete) return;
        const ctx = this.ctx;
        ctx.drawImage(
            goalie.img,
            this.bgRect.x + goalie.x,
            this.bgRect.y + goalie.y,
            goalie.w,
            goalie.h
        );
    }
}

class Puck {
    constructor(sx, sy, tx, ty, baseSpeed, radius = 14, rotation = 0) {
        this.x = sx;
        this.y = sy;
        this.tx = tx;
        this.ty = ty;
        this.radius = radius;
        this.rotation = rotation; // 🟢 поворот букета

        const dx = tx - sx;
        const dy = ty - sy;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1.0;
        
        this.vx = dx / distance * baseSpeed;
        this.vy = dy / distance * baseSpeed;
        
        this.fade = false;
        this.opacity = 255;
        this.alive = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        if (this.fade) {
            this.alive = false;
        }
    }

    draw(ctx, bgRect) {
        const screenX = bgRect.x + this.x;
        const screenY = bgRect.y + this.y;
        const game = window.goalieGameInstance;
        const img = game.assets?.bouquet;

        ctx.save();
        ctx.globalAlpha = this.opacity / 255;

        if (img && img.complete) {
            const scale = game.BOUQUET_SCALE * game.bgScale;
            const w = img.width * scale;
            const h = img.height * scale;

            ctx.translate(screenX, screenY);
            ctx.rotate(this.rotation);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

window.addEventListener('load', () => {
    window.goalieGameInstance = new GoalieClicker(); // 🟢 глобальная ссылка
});
