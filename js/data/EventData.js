// js/data/EventData.js

const GAME_EVENTS = [
    {
        id: "spring_of_life",
        title: "생명의 샘",
        desc: "숲 깊은 곳에서 맑은 샘물을 발견했습니다.\n상처 입은 몸을 담그면 치유될 것 같습니다.",
        // [조건] 체력이 가득 차지 않았을 때만 등장
        req: (data) => data.currentHp < data.maxHp, 
        
        choices: [
            {
                text: "[마신다] 체력 30% 회복",
                req: null, // 항상 가능
                effect: (scene, data) => {
                    const heal = Math.floor(data.maxHp * 0.3);
                    data.currentHp = Math.min(data.currentHp + heal, data.maxHp);
                    return `시원한 물을 마시자 기운이 솟아납니다.\n(체력 +${heal} 회복)`;
                }
            },
            {
                text: "[담는다] '성수' 유물 획득 (빈 병 필요)",
                // [조건] 특정 유물이 있어야 선택 가능
                req: (data) => data.artifacts && data.artifacts.includes('empty_bottle'),
                effect: (scene, data) => {
                    data.addArtifact('holy_water'); 
                    return "빈 병에 샘물을 가득 담았습니다.\n(유물 [성수] 획득)";
                }
            },
            {
                text: "[떠난다] 아무것도 하지 않음",
                req: null,
                effect: (scene, data) => "당신은 조용히 자리를 떴습니다."
            }
        ]
    },
    {
        id: "mystery_merchant",
        title: "수상한 상인",
        desc: "음침한 골목에서 상인이 말을 겁니다.\n'좋은 물건이 있는데... 보시겠소?'",
        req: null, // 조건 없음 (랜덤 등장)
        choices: [
            {
                text: "[구매] 랜덤 유물 뽑기 (100 G)",
                req: (data) => data.gold >= 100,
                effect: (scene, data) => {
                    data.addGold(-100);
                    // (임시) 랜덤 유물 지급 로직
                    const randomKey = Math.random() > 0.5 ? 'valve' : 'thorn';
                    data.addArtifact(randomKey);
                    return `상인은 돈을 챙기더니 물건을 건네주고 사라졌습니다.\n(골드 -100, 유물 획득)`;
                }
            },
            {
                text: "[강탈] 강제로 뺏는다 (체력 -20)",
                req: null,
                effect: (scene, data) => {
                    data.currentHp -= 20;
                    data.addArtifact('recycler');
                    return "격렬한 몸싸움 끝에 물건을 뺏었지만 상처를 입었습니다.\n(체력 -20, [고철 회수기] 획득)";
                }
            },
            {
                text: "[거절] 필요 없다",
                req: null,
                effect: () => "상인은 혀를 차며 어둠 속으로 사라집니다."
            }
        ]
    }
];

// 전역 변수로 등록
window.GAME_EVENTS = GAME_EVENTS;