// js/data.js

// 배치 제한선
const DEPLOY_LIMIT = 266; 

const UNIT_STATS = {
    '검사': { 
        cost: 2, hp: 50, damage: 5, range: 40, attackSpeed: 1.0, speed: 60, color: 0x00ff00,
        castTime: 0, 
        projectileSpeed: 0,
        detectRange: 200, 
        count: 3,
        attackType: 'SLASH', 
        image: 'img_swordman',
        race: '보병',
        traits: [] 
    },
    '궁수': { 
        cost: 3, hp: 30, damage: 15, range: 180, attackSpeed: 1.5, speed: 50, color: 0x00ffff,
        castTime: 0.5, // 0.5초 조준 (이때 CC기 맞으면 캔슬됨)
        projectileSpeed: 300,
        detectRange: 350, 
        count: 2,
        attackType: 'SHOOT', 
        image: 'img_archer',
        race: '보병',
        traits: [] 
    },
    '힐러': { 
        cost: 3, hp: 60, damage: -15, range: 100, attackSpeed: 2.0, speed: 45, color: 0xffffff,
        castTime: 0, 
        projectileSpeed: 200,
        detectRange: 250, 
        attackType: 'THRUST', 
        image: 'img_healer',
        race: '보병',
        traits: [] 
    },
    '방벽': { 
        cost: 1, hp: 200, damage: 0, range: 0, attackSpeed: 0, speed: 0, color: 0x888888,
        projectileSpeed: 0,
        detectRange: 0,   
        image: 'img_wall',
        race: '구조물',
        traits: [] 
    },
    '암살자': { 
        cost: 4, hp: 80, damage: 9999, range: 40, attackSpeed: 0.8, speed: 70, color: 0xaa00ff,
        castTime: 0, 
        projectileSpeed: 0,
        detectRange: 250, 
        attackType: 'THRUST', 
        image: 'img_assassin',
        race: '보병',
        traits: ['침투', '은신'] 
    },
    '적군': { 
        cost: 2, hp: 80, damage: 8, range: 40, attackSpeed: 1.0, speed: 40, color: 0xff0000,
        castTime: 0, 
        projectileSpeed: 0,
        detectRange: 200, 
        attackType: 'SLASH', 
        image: 'img_enemy',
        race: '보병',
        traits: [] 
    },
    '기지': { 
        cost: 0, hp: 1000, damage: 0, range: 0, attackSpeed: 0, speed: 0, color: 0x000000,
        projectileSpeed: 0,
        detectRange: 0,
        race: '구조물',
        traits: [] 
    }
};
// js/data.js

// ★ CC기 규칙 정의 (확장성 핵심)
const CC_RULES = {
    'STUN':      { canMove: false, canAttack: false, cancelCast: true,  msg: "😵 STUN" },
    'KNOCKBACK': { canMove: false, canAttack: false, cancelCast: true,  msg: "🔙 PUSH" },
    'SILENCE':   { canMove: true,  canAttack: true,  cancelCast: true,  msg: "😶 SILENCE" }, // 이동/평타는 되는데 스킬(캐스팅)만 못함
    'ROOT':      { canMove: false, canAttack: true,  cancelCast: false, msg: "🔒 ROOT" },    // 이동만 불가
    'SLOW':      { canMove: true,  canAttack: true,  cancelCast: false, msg: "🐌 SLOW" }     // 속도만 느려짐 (로직 별도 처리)
};

const COMMANDERS = {
    'knight': { 
        name: '기사단장', 
        desc: '모든 [보병] 유닛의\n체력/공격력 +20%', 
        type: 'PASSIVE_BUFF',
        color: 0xffaa00,
        image: 'cmd_knight',
        hp: 1800 
    },
    'mage': { 
        name: '대마법사', 
        desc: '모든 [스킬] 카드의\n코스트 -1 감소', 
        type: 'PASSIVE_COST',
        color: 0x00ffff,
        image: 'cmd_mage',
        hp: 800 
    },
    'artillery': { 
        name: '포병대장', 
        desc: '3초마다 가장 가까운 적에게\n포격 (피해량 30)', 
        type: 'ACTIVE_ATK',
        damage: 30,
        cooldown: 3.0,
        range: 2000,
        color: 0xff5555,
        image: 'cmd_artillery', 
        hp: 1200 
    }
};

let selectedCommander = 'artillery';

const SKILL_STATS = {
    '화염구': { 
        cost: 4, 
        radius: 70, 
        color: 0xff8800,
        skillType: 'OFFENSE',
        damage: 60,
        stun: 0,
        shield: 0,
        hasProjectile: true, // ★ 콤마 추가!
        friendlyFire: true   // 아군도 맞음
    },
    '방어막': { 
        cost: 3, 
        radius: 50, 
        color: 0x8888ff,
        skillType: 'DEFENSE',
        damage: 0,
        stun: 0,
        shield: 50,
        hasProjectile: false 
    },
    '얼음': { 
        cost: 3, 
        radius: 60, 
        color: 0x0088ff,
        skillType: 'OFFENSE',
        damage: 10,
        stun: 2.0,
        shield: 0,
        hasProjectile: false, // ★ 콤마 추가!
        friendlyFire: false 
    },
    '돌멩이': { 
        cost: 1, 
        radius: 20, 
        color: 0xaaaaaa,
        skillType: 'OFFENSE',
        damage: 15,
        stun: 0.5,
        shield: 0,
        hasProjectile: true, // ★ 콤마 추가!
        friendlyFire: false 
    }
};

const STARTER_DECK = [
    'Unit-검사', 'Unit-검사', 'Unit-검사',
    'Unit-궁수', 'Unit-궁수',
    'Unit-방벽', 'Unit-방벽',
    'Unit-암살자', 'Unit-암살자',
    'Skill-돌멩이', 'Unit-힐러',
    'Skill-화염구', 
    'Skill-방어막'
];

const MAX_HAND = 7;
const MAX_COST = 50;
const RECOVERY_COST = 10;

let currentStage = 1;
let difficultyLevel = 0; 

const DIFFICULTY_MODS = {
    0: { hpMult: 1.0, dmgMult: 1.0, costPenalty: 0 }
};

for (let i = 1; i <= 20; i++) {
    DIFFICULTY_MODS[i] = {
        hpMult: 1.0 + (i * 0.1),   
        dmgMult: 1.0 + (i * 0.1),  
        costPenalty: Math.floor(i / 5) * -2 
    };
}

function getEnemyStats(name) {
    const base = UNIT_STATS[name];
    const mod = DIFFICULTY_MODS[difficultyLevel] || DIFFICULTY_MODS[0];

    if (name === '적군' || name === '기지') {
        return {
            ...base,
            hp: Math.floor(base.hp * mod.hpMult),
            damage: Math.floor(base.damage * mod.dmgMult)
        };
    }
    return base;
}

const ENEMY_COMMANDERS = {
    1: { 
        name: '초보 검투사', 
        deck: ['적군'], 
        aiType: 'BASIC', 
        baseCost: 15
    },
    2: { 
        name: '백인대장', 
        deck: ['적군', '궁수', '검사'], 
        aiType: 'BALANCED', 
        baseCost: 15
    },
    3: { 
        name: '암살자 길드장', 
        deck: ['적군', '암살자', '방벽'], 
        aiType: 'TRICKY', 
        baseCost: 15
    },
    5: { 
        name: '화염의 마법사', 
        deck: ['검사', '방벽', '화염구'], 
        aiType: 'TACTICAL_AOE', 
        baseCost: 15
    }
};

const DEFAULT_ENEMY_COMMANDER = { 
    name: '무명 지휘관', deck: ['적군'], aiType: 'BASIC', baseCost: 15 
};

const MAP_DATA = {
    'DefaultMap': { 
        tileSize: 40, mapWidth: 25, mapHeight: 15, image: 'bg_battle',
        getGrid: function(w, h) { return Array(h).fill().map(() => Array(w).fill(0)); }
    },
    'Map1': { 
        tileSize: 40, mapWidth: 25, mapHeight: 15, image: 'bg_battle',
        getGrid: function(w, h) { 
            let grid = Array(h).fill().map(() => Array(w).fill(0));
            for(let y=0; y<h; y++) {
                grid[y][10] = 1; 
                if (y===4 || y===10) grid[y][10] = 0; 
            }
            for(let y=0; y<h; y++) {
                for(let x=0; x<5; x++) grid[y][x] = 2;
            }
            return grid;
        }
    }
};

function getMapData(id) {
    return MAP_DATA[id] || MAP_DATA['DefaultMap'];
}