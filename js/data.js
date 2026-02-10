// js/data.js

// 배치 제한선
const DEPLOY_LIMIT = 266; 

// ============================================================
// ⚔️ 유닛 데이터 (Unit Stats)
// ============================================================
const UNIT_STATS = {
    '검사': {
        cost: 3,
        hp: 120,
        damage: 12,
        range: 50, // 근접
        attackSpeed: 1.2,
        speed: 60,
        race: '보병',
        desc: '밸런스가 잡힌 기본 보병입니다.',
        image: 'img_swordman',
        rarity: 'COMMON',
        
        // ★ [전략] 초반 러시 및 라인 유지
        bonusTime: [0, 3],
    bonusEffect: { stat: 'cost', val: -1 },
    parts: { 
            body: 'body_knight', 
            weapon: 'weapon_sword', 
            acc: 'acc_shield' 
        }
    },

    '궁수': {
        cost: 4,
        hp: 80,
        damage: 15,
        range: 350, // 긴 사거리
        attackSpeed: 3, // 약간 느림
        speed: 45,
        count: 1,
        race: '보병',
        desc: '멀리서 적을 공격하는 지원 사격수입니다.',
        image: 'img_archer',
        rarity: 'COMMON',
        attackType: 'SHOOT',      // 투사체 발사 모드 설정
        projectileSpeed: 400,     // 투사체 속도

        // ★ [전략] 후반에 안정적인 프리딜 구도 형성
        bonusTime: [7, 10],
        bonusEffect: { stat: 'damage', val: 5 },
        parts: {
            body: 'body_archer',
            weapon: 'weapon_bow'
        },
    },

    '방벽': {
        cost: 2,
        hp: 400,
        damage: 0,
        range: 0,
        attackSpeed: 0,
        speed: 0, // 이동 불가
        race: '구조물',
        desc: '적의 이동을 막고 공격을 받아냅니다.',
        image: 'img_wall',
        rarity: 'COMMON',

        // ★ [전략] 극초반에 튼튼한 진지 구축
        bonusTime: [0, 2],
        bonusEffect: { stat: 'hp', val: 150 }
    },

    '힐러': {
        cost: 5,
        hp: 100,
        damage: 15, 
        range: 250,
        attackSpeed: 2.0,
        speed: 40,
        race: '지원가',
        desc: '아군의 체력을 회복시킵니다.',
        role: 'HEALER',
        image: 'img_healer',
        rarity: 'RARE',

        // ★ [전략] 난전이 벌어지는 중반에 슈퍼 세이브
        bonusTime: [3, 7],
        bonusEffect: { stat: 'damage', val: 15 },
        parts: {
            // 이번에 새로 추가한 로브와 지팡이!
            body: 'body_robe',      
            weapon: 'weapon_staff',
            acc: 'acc_book' // 책이 없다면 acc_aura 등 다른 걸로 대체 가능
        },
    },

    '암살자': {
        cost: 6,
        hp: 140,
        damage: 45,
        range: 50,
        attackSpeed: 0.8, // 빠름
        speed: 90, // 매우 빠름
        race: '보병',
        traits: ['은신', '침투'], // 특성 예시
        desc: '빠르게 적진으로 파고듭니다.',
        image: 'img_assassin',
        rarity: 'EPIC',

        // ★ [전략] 막바지 킬 캐치 및 기지 테러
        bonusTime: [8, 10],
        bonusEffect: { stat: 'damage', val: 50, unit: '%' },
        parts: {
            body: 'body_ninja',
            weapon: 'weapon_dagger'
        },
    },
    '광전사': {
        cost: 5,
        hp: 180,
        damage: 25,       // 공격력은 보통이지만 광역이라 총 피해량은 높음
        range: 60,        // 근접이지만 칼이 커서 사거리 약간 김
        attackSpeed: 1.5, // 무거워서 약간 느림
        speed: 55,
        race: '보병',
        desc: '거대한 검을 휘둘러 주변 적에게 광역 피해를 줍니다.',
        image: 'img_berserker', // (PNG 파일이 없다면 기존 기사 아이콘 등 임시 사용)
        rarity: 'RARE',
        
        // ★ [핵심] 공격 타입 정의
        attackType: 'SPLASH', 
        weaponAnimType: 'HEAVY_SWING',
        splashRadius: 30, // 주 타겟 주변 30px 반경에 피해
        splashAngle: 120,
        parts: {
            body: 'body_knight',      // 몸통은 기사 공유
            weapon: 'weapon_greatsword', // 무기는 대검
                  // 등 뒤에 투기(오라)
        },
        
        bonusTime: [5, 8],
        bonusEffect: { stat: 'damage', val: 10 }
    },

    // (기존 레거시 데이터 제거 후 정리된 적군/기지 데이터)
    '적군': { 
        cost: 2, hp: 80, damage: 8, range: 40, attackSpeed: 1.0, speed: 40, color: 0xff0000,
        projectileSpeed: 0,
        detectRange: 200, 
        attackType: 'SLASH', 
        image: 'img_enemy',
        race: '보병',
        traits: [] ,
        rarity: 'COMMON'
    },
    '기지': { 
        cost: 0, hp: 1000, damage: 0, range: 0, attackSpeed: 0, speed: 0, color: 0x000000,
        projectileSpeed: 0,
        detectRange: 0,
        race: '구조물',
        traits: [] ,
        rarity: 'COMMON',
        image: 'base_knight' // 이미지 키 추가 권장
    }
};

// ★ CC기 규칙 정의 (확장성 핵심)
const CC_RULES = {
    'STUN':      { canMove: false, canAttack: false, cancelCast: true,  msg: "😵 STUN" },
    'KNOCKBACK': { canMove: false, canAttack: false, cancelCast: true,  msg: "🔙 PUSH" },
    'SILENCE':   { canMove: true,  canAttack: true,  cancelCast: true,  msg: "😶 SILENCE" },
    'ROOT':      { canMove: false, canAttack: true,  cancelCast: false, msg: "🔒 ROOT" },
    'SLOW':      { canMove: true,  canAttack: true,  cancelCast: false, msg: "🐌 SLOW" }
};

// ============================================================
// 👑 지휘관 데이터
// ============================================================
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

// ============================================================
// ✨ 스킬 데이터 (Skill Stats)
// ============================================================
const SKILL_STATS = {
    '화염구': {
        cost: 4,
        damage: 50,
        radius: 120, // 폭발 반경
        desc: '범위 내 적들에게 화염 피해를 입힙니다.',
        image: 'img_fireball',
        rarity: 'COMMON',
        color: 0xff4400,        // 주황색 폭발
        hasProjectile: true,    // 하늘에서 떨어지는 연출
        // ★ [전략] 뭉쳐있는 적 후반 정리
        bonusTime: [5, 10],
        bonusEffect: { stat: 'damage', val: 30 }
    },

    '돌멩이': {
        cost: 1,
        damage: 10,
        radius: 30,
        desc: '적 하나에게 소량의 피해를 줍니다. (저비용)',
        image: 'img_stone',
        rarity: 'COMMON',
        color: 0x888888,        // 회색
        hasProjectile: true,    // 투사체 있음
        // ★ [전략] 아무 때나 부담 없이 사용
        bonusTime: [0, 10],
        bonusEffect: { stat: 'stun', val: 0.5 }
    },

    '방어막': {
        cost: 3,
        effect: 'shield',
        value: 50,
        desc: '아군에게 일시적인 보호막을 부여합니다.',
        image: 'img_shield',
        rarity: 'RARE',
        color: 0x00ffff,        // 시안(Cyan)색
        hasProjectile: false,   // 즉시 발동
        // ★ [전략] 적 공격이 시작되기 전 선제 방어
        bonusTime: [0, 5],
        bonusEffect: { stat: 'value', val: 50 } // 방어막은 'value' 속성 사용
    },

    '얼음': {
        cost: 5,
        effect: 'freeze',
        duration: 3.0,
        desc: '범위 내 적들을 3초간 얼립니다.',
        image: 'img_ice',
        rarity: 'EPIC',
        color: 0x0088ff,        // 파란색
        hasProjectile: false,   // 즉시 발동 (바닥에서 솟아오름)
        // ★ [전략] 위급한 중후반에 메즈기 강화
        bonusTime: [5, 9],
        bonusEffect: { stat: 'duration', val: 2.0 } // 지속시간 증가
    }
};

const STARTER_DECK = [
    'Unit-검사', 'Unit-광전사', 'Unit-암살자',
    'Unit-궁수', 'Unit-광전사',
    'Unit-방벽',
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
// 기존 숫자 키 방식 -> ID 기반 풀(Pool) 방식으로 변경
const ENEMY_DATA_POOL = {
    // [Tier 1] 초반 잡몹 구간 -> ★ 테스트를 위해 화염 법사로 교체!
    'goblin_rookie': { 
        name: '고블린 떼', 
        tier: 1, role: 'NORMAL',
        hp: 1200, image: 'base_enemy_1', 
        deck: ['적군', '적군', '적군'], aiType: 'AGGRESSIVE', baseCost: 8 
    },
    'goblin_horde': { 
        name: '고블린 떼', 
        tier: 1, role: 'NORMAL',
        hp: 1200, image: 'base_enemy_1', 
        deck: ['적군', '적군', '적군'], aiType: 'AGGRESSIVE', baseCost: 8 
    },

    // [Tier 1] 정예/중반
    'centurion': { 
        name: '백인대장', 
        tier: 1, role: 'ELITE', 
        hp: 2500, image: 'base_enemy_2', 
        deck: ['적군', '궁수', '검사'], aiType: 'BALANCED', baseCost: 12 
    },

    // [Tier 1] 보스
    'assassin_master': { 
        name: '암살자 길드장', 
        tier: 1, role: 'BOSS', 
        hp: 4000, image: 'base_enemy_3', 
        deck: ['적군', '암살자', '방벽'], aiType: 'TRICKY', baseCost: 15 
    },

    // [Tier 2] 예시
    'fire_mage': { 
        name: '화염의 마법사', 
        tier: 2, role: 'NORMAL', 
        hp: 2000, image: 'base_enemy_2', 
        deck: ['검사', '방벽', '화염구'], aiType: 'TACTICAL_AOE', baseCost: 15 
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

// ★ [핵심] 전역 변수 등록 (다른 파일에서 사용 가능하도록)
window.DEPLOY_LIMIT = DEPLOY_LIMIT;
window.UNIT_STATS = UNIT_STATS;
window.CC_RULES = CC_RULES;
window.COMMANDERS = COMMANDERS;
window.SKILL_STATS = SKILL_STATS;
window.STARTER_DECK = STARTER_DECK;
window.MAX_HAND = MAX_HAND;
window.MAX_COST = MAX_COST;
window.RECOVERY_COST = RECOVERY_COST;
window.DEFAULT_ENEMY_COMMANDER = DEFAULT_ENEMY_COMMANDER;
window.getEnemyStats = getEnemyStats;
window.getMapData = getMapData;
window.ENEMY_DATA_POOL = ENEMY_DATA_POOL;