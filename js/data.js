// js/data.js

// 배치 제한선 (맵의 1/3 지점)
// js/data.js

// 배치 제한선
const DEPLOY_LIMIT = 266; 

const UNIT_STATS = {
    '검사': { 
        cost: 2, hp: 120, damage: 10, range: 40, attackSpeed: 1.0, speed: 60, color: 0x00ff00,
        projectileSpeed: 0, // 0이면 근접 공격 (즉발)
        traits: [] 
    },
    '궁수': { 
        cost: 3, hp: 70, damage: 25, range: 180, attackSpeed: 1.5, speed: 50, color: 0x00ffff,
        projectileSpeed: 300, // ★ 투사체 속도 (화살)
        traits: [] 
    },
    '힐러': { 
        cost: 3, hp: 60, damage: -15, range: 100, attackSpeed: 2.0, speed: 45, color: 0xffffff,
        projectileSpeed: 200, // ★ 힐 구체 날아감
        traits: [] 
    },
    '방벽': { 
        cost: 1, hp: 200, damage: 0, range: 0, attackSpeed: 0, speed: 0, color: 0x888888,
        projectileSpeed: 0,
        traits: ['구조물'] 
    },
    '암살자': { 
        cost: 4, hp: 80, damage: 30, range: 40, attackSpeed: 0.8, speed: 70, color: 0xaa00ff,
        projectileSpeed: 0,
        traits: ['침투', '은신'] 
    },
    '적군': { 
        cost: 0, hp: 80, damage: 8, range: 40, attackSpeed: 1.0, speed: 40, color: 0xff0000,
        projectileSpeed: 0,
        traits: [] 
    },
    '기지': { 
        cost: 0, hp: 1000, damage: 0, range: 0, attackSpeed: 0, speed: 0, color: 0x000000,
        projectileSpeed: 0,
        traits: ['구조물'] 
    }
};

const SKILL_STATS = {
    '화염구': { cost: 4, radius: 70, damage: 60, color: 0xff8800 },
    '방어막': { cost: 3, radius: 50, shield: 50, color: 0x8888ff },
    '얼음': { cost: 3, radius: 60, damage: 10, stun: 2.0, color: 0x0088ff },
    '돌멩이': { cost: 1, radius: 20, damage: 15, stun: 0.5, color: 0xaaaaaa }
};

const STARTER_DECK = [
    'Unit-검사', 'Unit-검사', 'Unit-검사',
    'Unit-궁수', 'Unit-궁수',
    'Unit-방벽', 'Unit-방벽',
    'Unit-암살자', 'Unit-암살자',
    'Skill-돌멩이', 'Skill-돌멩이',
    'Skill-화염구', 
    'Skill-방어막'
];

const MAX_HAND = 7;
const MAX_COST = 50;
const RECOVERY_COST = 10;

// ★ [추가] 현재 스테이지 관리 (전역 변수)
let currentStage = 1;

// js/data.js 하단 추가

// js/data.js 맨 아래 부분 교체

// 현재 난이도 레벨 (0: 기본, 1~20: 고행 단계)
let difficultyLevel = 0; 

// 난이도 데이터 (자동 생성)
const DIFFICULTY_MODS = {
    0: { hpMult: 1.0, dmgMult: 1.0, costPenalty: 0 } // 기본 (0단계)
};

// 1단계 ~ 20단계 자동 생성
// 규칙: 단계당 적 체력 +10%, 공격력 +10% 증가
// 5단계마다 코스트 페널티 추가 (예시)
for (let i = 1; i <= 20; i++) {
    DIFFICULTY_MODS[i] = {
        hpMult: 1.0 + (i * 0.1),   // 1단계당 체력 10% 증가 (20단계 = 3배)
        dmgMult: 1.0 + (i * 0.1),  // 1단계당 공격력 10% 증가
        costPenalty: Math.floor(i / 5) * -2 // 5단계마다 시작 코스트 -2
    };
}

// 적 스탯 가져오는 함수
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