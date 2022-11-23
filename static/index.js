'use strict';
function scale(percent, min, max) { return (max-min)*percent + min }
function random_float(min, max) { return scale(Math.random(), min, max) }
function random_int(min, max) { return Math.floor(random_float(min, max)); }
function direction(rad, speed) { return {dx: Math.cos(rad)*speed, dy: Math.sin(rad)*speed } }
function random_direction(speed) { return direction(random_float(0, 2*Math.PI), speed) }
function random_color() {
    const red = random_float(0, 255);
    const green = random_float(0, 255);
    const blue = random_float(0, 255);
    return `rgba(${red}, ${green}, ${blue}, 0.5)`
}
function random_color_red() {
    const red = random_float(150, 255);
    const green = random_float(0, 100);
    const blue = random_float(0, 50);
    return `rgba(${red}, ${green}, ${blue}, 1)`
}
function random_color_blue() {
    const red = random_float(0, 50);
    const blue = random_float(150, 255);
    const green = random_float(0, 255);
    return `rgba(${red}, ${green}, ${blue}, 1)`
}

class ObjectSet {
    objects = {}
    size = 0
    add(obj) {
        this.objects[obj.id] = obj; this.size++;
    }
    remove(obj) { delete this.objects[obj.id]; this.size--; }
    destroy() { this.each(x => { x.destroy() }) }
    each(f) { Object.values(this.objects).forEach(f) }
    get example() { return Object.values(this.objects)[0] }
}

class GameObject {
    destroyed = false
    sets = []
    id = -1;
    constructor(g, o) {
        if (!o.e) throw "Element expected for every game object"
        if (!(o.id > 0)) throw "Id expected for every game object"
        o = {
            x: o.e.position().left,
            y: o.e.position().top,
            width: o.e.width(),
            height: o.e.height(),
            tags: [],
            ...o,
        }
        for (let p in o) {
            if (typeof(o[p])!='undefined') this[p] = o[p]
        }

        if (this.color) this.e.css("background-color", this.color);
        for (let tag of this.tags) this.tag(g, tag);
    }
    tag(g, tag) {
        const set = g.getTag(tag)
        this.sets.push(set)
        set.add(this)
        this.e.addClass(tag);
    }
    get collision() {
        return {
            minx: this.x,
            miny: this.y,
            maxx: this.x + this.width,
            maxy: this.y + this.height,
        }
    }
    tick(g) {
        // By default, destroy objects when they exit the game field
        if (this.x < g.screen.minX
            || this.x > g.screen.maxX
            || this.y < g.screen.minY
            || this.y > g.screen.maxY) this.destroy();
    }
    render(g) {
        this.e.css("left", `${this.x}px`);
        this.e.css("top", `${this.y}px`);
    }
    get middle() {
        return {
            x: this.x + this.width/2,
            y: this.y + this.height/2,
        }
    }
    destroy() {
        this.destroyed = true;
        this.e.remove();
        this.sets.forEach(set => {
            set.remove(this);
        })
        this.sets = [];
    }
    colliding(o2) {
        if (this == o2) return false;
        const c1 = this.collision, c2=o2.collision;
        if (c1.maxx < c2.minx) return false;
        if (c2.maxx < c1.minx) return false;
        if (c1.maxy < c2.miny) return false;
        if (c2.maxy < c1.miny) return false;
        return true;
    }
}

class Shooty extends GameObject {
    timeSinceBullet = 0
    health = 1.0
    constructor(g, options) {
        super(g, {
            fireRate: 1.0, // Bullets per second
            bulletType: FlyingBullet,
            bulletSpeed: 100.0, // Speed at which a bullet flies out
            shooting: false,
            ...options
        })
        this.bulletTime = 1.0/this.fireRate
    }
    damage(amount) {
        amount ||= 1;
        this.health -= amount;
    }
    die(g) {
        g.blam(this, 100);
        this.destroy();
    }
    tick(g) {
        if (this.health <= 0) this.die(g);
        this.timeSinceBullet += g.elapsed;
        if (this.shooting && this.timeSinceBullet > this.bulletTime) {
            this.timeSinceBullet -= this.bulletTime
            this.shoot(g)
        }
    }
    render(g) {
        super.render(g)
        this.e.css("--health", this.health);
    }
    shoot(g, angle) {
        const options = {
            x: this.middle.x,
            y: this.middle.y,
            dx: this.bulletSpeed*Math.cos(angle),
            dy: this.bulletSpeed*Math.sin(angle),
        }
        //console.log(angle, this.middle, this.bulletSpeed, options)
        const bullet = g.add(this.bulletType, options)
    }
}
class Player extends Shooty {
    angle = 0
    constructor(g, options) {
        super(g, {
            tags: ["player"], 
            fireRate: 10.0, // Bullets per second
            angularSpeed: 1, // Radians per second
            shooting: false,
            ...options
        })
        $(document).on("mousemove", (ev) => {
            g.r = g.field[0].getBoundingClientRect();
            this.x = ev.clientX - g.r.left - this.width/2;
            this.y = ev.clientY - g.r.top - this.width/2;
        }).on("mousedown", (ev) => {
            this.shooting = true
        }).on("mouseup", (ev) => {
            this.shooting = false
        })
    }
    stun() {
    }
    tick(g) {
        super.tick(g)
        this.angle += this.angularSpeed * g.elapsed;
        this.angle %= Math.PI;
    }
    shoot(g) {
        super.shoot(g, scale(this.angle/Math.PI, Math.PI*(5/4), Math.PI*(7/4)))
    }
    // TODO: Die and restart logic
}
class Boss extends Shooty {
    angle=0
    constructor(g, options) {
        super(g, {
            angularSpeed: 1, // Radians per second
            audio: options.e,
            fireRate: 40.0, // Bullets per second
            bulletType: FlyingBullet,
            tags: ["boss"],
            playing: false,
            ...options,
        })
        this.bulletTime = 1.0/this.fireRate

        this.audio[0].volume = this.maxVolume;
        this.audio.on("play", () => {
            this.playing = true
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.audioSource = this.audioCtx.createMediaElementSource(this.audio[0]);
                this.analyser = window.analyser = this.audioCtx.createAnalyser();
            }
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        });
        this.audio.on("pause", () => {
            this.playing = false
            this.audioSource.disconnect();
            this.analyser.disconnect();
        });
    }
    // TODO: Let user adjust volume still
    tick(g) {
        this.shooting = this.playing;
        super.tick(g);
        if (!this.paused) {
            this.angle += this.angularSpeed * g.elapsed;
        }
        this.audio[0].volume = this.maxVolume * Math.max(0, this.health);
    }
    shoot(g) {
        super.shoot(g, this.angle)
    }
}

class Poof extends GameObject {
    constructor(g, options) {
        options.color = random_color();
        options.e = $(`<div class="poof"></div>`);
        super(g, options);
        this.dir = random_direction(random_float(50, 200));
        this.e.height(this.size);
        this.e.width(this.size);
    }
    tick(g) {
        super.tick(g)
        this.x += this.dir.dx * g.elapsed;
        this.y += this.dir.dy * g.elapsed;
        this.countdown -= g.elapsed;
        if (this.countdown < 0) this.destroy();
    }
}
class FlyingBullet extends GameObject {
    constructor(g, options) {
        super(g, {
            e: $(`<div class="bullet ${options.team}"></div>`),
            countdown: 15,
            bounceTime: 2,
            ...options
        });
        this.dx = options.dx
        this.dy = options.dy
    }
    tick(g) {
        super.tick(g)
        this.x += this.dx * g.elapsed;
        this.y += this.dy * g.elapsed;
        this.countdown -= g.elapsed;
        if (this.x < g.screen.minX) {
            this.x = g.screen.minX;
            this.dx *= -1;
            this.countdown -= this.bounceTime;
        } else if (this.x > g.screen.maxX) {
            this.x = g.screen.maxX;
            this.dx *= -1;
            this.countdown -= this.bounceTime;
        }
        if (this.y < g.screen.minY) {
            this.y = g.screen.minY;
            this.dy *= -1;
            this.countdown -= this.bounceTime;
        } else if (this.y > g.screen.maxY) {
            this.y = g.screen.maxY;
            this.dy *= -1;
            this.countdown -= this.bounceTime;
        }
        if (this.countdown <= 0) this.destroy();
    }
    render(g) {
        super.render(g);
        this.e.css("opacity", scale(this.countdown/10.0, 0.1, 1));
    }
}
class BossBullet extends FlyingBullet {
    constructor(g, options) {
        super(g, {
            team: "boss",
            color: random_color_blue(),
            tags: ["bossBullet"], 
            ...options
        });
    }
}
class PlayerBullet extends FlyingBullet {
    constructor(g, options) {
        super(g, {
            tags: ["playerBullet"], 
            team: "player",
            color: random_color_red(),
            bounceTime: 1000,
            ...options
        });
    }
}

class Game {
    nextId = 1
    field = $(".game")
    objectCounter = $(".object-counter")
    frameCounter = $(".frame-counter")
    fps = $(".fps")
    frames = 0
    elapsed = 0
    start = Date.now()
    collisionHandlers = [] // [[ObjectSet, ObjectSet, handler]]
    tags = {} // Lookup from string -> ObjectSet
    constructor() {
        this.lastUpdate = Date.now()
        $('<style>.game > * { position: absolute; }</style>').appendTo("html > head")
    }
    add(cls, args) {
        const o = new cls(this, {id: this.nextId++, ...args})
        o.tag(this, "all"); // Will be automatically removed on .destroy() this way
        this.field.append(o.e);
        o.render(this);
        return o;
    }
    get all() { return this.getTag("all"); }
    frame() {
        // Global updates
        const now = Date.now();
        this.elapsed = (now - this.lastUpdate) / 1000.0;
        this.lastUpdate = now;
        this.screen = { minX: 0, minY: 0, maxX: this.field.width(), maxY: this.field.height() };

        // Main engine loop
        this.all.each(o => {
            o.tick(this);
            o.render(this);
        })
        this.checkCollisions();

        // Debug info
        this.objectCounter.text(this.all.size);
        this.frameCounter.text(this.frames++);
        this.fps.text(Math.round(1000 * this.frames / (now - this.start)))
    }
    checkCollisions() {
        for (let [set1, set2, handler] of this.collisionHandlers) {
            set1.each(o1 => {
                set2.each(o2 => {
                    if (o1.colliding(o2)) handler(o1, o2);
                })
            })
        }
    }
    blam(o, size) { // blam/poof idea from http://canonical.org/~kragen/sw/dev3/qvaders
        const numPoofs=Math.ceil(Math.sqrt(size));
        for (let i=0; i<numPoofs; i++) {
            game.add(Poof, {
                x: o.x,
                y: o.y,
                size: random_int(2,size),
                countdown: Math.log(size)/4,
            });
        }
    }
    getTag(tag) { return this.tags[tag] ||= new ObjectSet(); }
    onCollide(tag1, tag2, f) {
        this.collisionHandlers.push([this.getTag(tag1), this.getTag(tag2), f]);
    }
    run() {
        let animating = false;
        setInterval(() => {
            if (!this.paused && !animating) {
                animating = true;
                this.frame();
                animating = false;
            }
        }, 30);
    }
}

$(document).ready(() => {
    let analyser, audioSource, audioCtx;
    const game = window.game = new Game();

    const player = window.player = game.add(Player, {
        e: $(".player"),
        bulletType: PlayerBullet,
        angularSpeed: 5,
    })
    const boss = window.blue = game.add(Boss, {
        e: $(".band.boss"),
        bulletType: BossBullet,
        audio: $("audio.band.boss"),
        angularSpeed: -5,
        maxVolume: 1,
    })

    const guyBullet = (guy, bullet) => {
        game.blam(bullet, 30);
        bullet.destroy();
        guy.damage(0.11);
    }
    const guyTutorial = (guy, thing) => {
        guy.stun(0.1);
    }
	const playerBand = (player, band) => {
		player.die();
	}
    game.onCollide("boss", "playerBullet", guyBullet)
    game.onCollide("player", "bossBullet", guyBullet)
	game.onCollide("player", "band", playerBand)
    //game.onCollide("player", "tutorialBullet", guyTutorial);
    const start = () => {
        $(document).off("mousedown", start)
        $(document).off("keydown", start)
        game.run()
        boss.audio[0].play()
    }
    $(document).on("mousedown", start)
    $(document).on("keydown", start)

});
