import './character-data.js';
const Characters=globalThis.KeeperCharacters;
export const POLICY_VERSION=3;
export const cardInstructions=`
【选取标准】这是给 KP 运行整部模组的完整可用资料。先保证人物、幕后事实、威胁机制、关键线索、空间和结局条件不遗漏，再按同一实体与同一主题合卡去重；精简的是重复和装饰，不是可玩内容。没有卡片数量目标或上限，不为少卡而漏项。角色、怪物和数值附录与正文同样重要；正文中只有一小段、只在失败分支出现或可选出场，也不能直接省略。
【truth 核心真相】完整提取 KP 需要掌握的幕后事实：事件成因与前史、真实身份与身体/意识关系、阵营计划与动机、关键人物遭遇、威胁来源与运作/传播/解除机制、关键误解、计划失败后的变化、不同解法及结局条件。每个独立因果或裁定主题均可成卡，不限定真相条数，不把几项独立机制压成一句概述。外形、普通道具、扮演建议和装饰不另列真相；但某道具或遭遇若决定威胁机制、现实变化、身份揭露或结局，其因果不能因属于道具/局部事件而被删去。具体获得方式归线索或场景。selection_reason 用一句话说明其对主事件或结局的必要性，不以“原文提到”作为理由。
【npc 人物】一个确定的人物一张卡，title 和 entity_name 均用同一个规范人物名。把身份、必要外形/特质、目标动机、所知/误信/隐瞒、扮演要点、透露条件、关键互动按短段汇总在这一张卡内；只填原文明示且有备团价值的部分。不拆成“某人的形象与特质”“某人的扮演要点”等卡片。已确认是同一人的别名统一到原文主要名字，正文注明别名；不能确认同一身份时不强行合并。不要把群体或不具名的不同人误并为一个人。尸体的发现归 clue；若死者身份、与其他人的关系、遇害经过是理解剧情的关键，人物卡仍保留其简档。明确在原文出现、承担交谈、救援、交易、调查、战斗、证言或条件分支作用的角色都要检查，包括主角、配角、路人职能角色、受害者、敌人、怪物、可选角色。独立怪物/敌人模板也各自一张，如标准教团成员和转化者，不并进首领。相同物种的普通个体可用同一原文数值模板，不把不同角色或不同意识因共用身体合并。
【人物分组与数值】npc 类仍统一存人物卡，character_type 填 enemy（原文明示敌对、攻击、阻挠或敌方怪物/模板）、npc（明确普通或友善互动者）、unknown（立场不足或会变化待判断），不得按邪恶外貌猜测阵营。保留条件下的立场变化。stats 按属性、派生、技能、战斗、能力、其他列表收录原文数值；label 是字段/攻击/技能名，value 直接复制对应数值或连续描述，保留百分比、伤害骰、困难/极难值、攻击次数、装甲、理智损失、法术代价及限定条件，不自行计算。source_block_ids 指向同卡 sources 中能支撑该值的引文；表格跨块分别引用，不能把多个角色相邻栏位的数字拼成一个角色。没有数值填空数组，不编造默认属性。
【scene 场景】必须是调查员能够进入、停留、移动、搜索或互动的空间，以具体场所为单位，一处可活动场所一张卡。title 和 entity_name 用地点名。正文按需要写空间构成、入口/出口/连接、可活动区域、调查对象和触发变化。列车车厢构成、废弃工厂及内部区域是场景；尸体、麻袋、信件、外形描写、单次事件、某人的状态都不是场景。“死去的富兰克林与物品麻袋”是调查对象，应归 clue 并写所在地点，不能因为能被调查就归 scene。不要把一个场所的每件物品拆成场景，也不要把明显独立可探索的地点笼统合并。selection_reason 明确此地点允许调查员进行哪些空间活动；不得虚构可进入性。
【clue 线索】按有调查指向的证据或发现组织，包含必要的位置、发现条件/检定、结果和指向。没有调查意义的普通道具和装饰不单独成卡。尸体与随身物品可按同一次发现合为一张线索卡；若独立证据有不同获得条件和指向，保留区别。
【timeline 时间线】仅保留影响运行的既往关键事件、时间约束、未来触发与先后条件，不把描述性细节都转为时间线。
【统一命名】entity_name 只在 npc、scene 填规范实体名，其余类别填空字符串。selection_reason 在 truth、scene 必须填写，其余可为空。先确定类别和整理单位，再写内容；跨批遇到同一人物/场所时复用 context 中的规范名。每个事实的所有有效信息都要有必要的逐字原文证据，不因合卡丢掉其他页的出处。
【逐段查漏】audit 阶段逐一重读 target_block_ids，结合已有卡片与 validation_gaps，核对每个有作用的人物/敌人/数值模板、每项幕后因果和结局分支是否已覆盖。只补缺失卡片和已有同名卡缺失的段落/数值；不要因为 overview 中提过、已有卡只有名字、前批因引文失败而被拦截，就当作已完整提取。原文查不到的内容列 issues，不从上一版结果编造证据。
【最终核对】仅 review 阶段可填写 decisions；其他阶段填空数组。对 context.existing_facts 中确实不是核心真相、或被误当场景的条目，可按精确的 category + title 提出 omit 或 reclassify 决定，说明理由。普通但必要的人物/场所资料应改到正确类别并填写规范 entity_name；只有确实重复或纯装饰的条目才 omit。不得因为卡片多、角色戏份少、真相超出预期条数而筛除。不要删去关键线索、人物或时间条件。无法确定时保留并列入 issues，不假装已经解决。`;
const normalized=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export const entityKey=f=>['npc','scene'].includes(f.category)&&f.entity_name?f.category+':'+normalized(f.entity_name):null;
export function curateCards(candidates,decisions=[]){
 const omitted=[],rejectedDecisions=[],staged=[];
 for(const original of candidates){let f={...original,sources:[...original.sources],stats:[...(original.stats||[])]};const decision=decisions.find(d=>d.category===f.category&&d.title===f.title);
  if(decision&&['truth','scene'].includes(f.category)){
   if(decision.action==='omit'){omitted.push({...f,reason:decision.reason});continue;}
   if(decision.action==='reclassify'&&['npc','scene','clue','timeline'].includes(decision.new_category)&&(!['npc','scene'].includes(decision.new_category)||decision.entity_name))f={...f,category:decision.new_category,entity_name:decision.entity_name||'',selection_reason:decision.reason};
   else rejectedDecisions.push(decision);
  }
  if(entityKey(f))f.title=f.entity_name.trim();staged.push(f);
 }
 const facts=[],indices=new Map(),seen=new Map(),issues=[];
 for(const f of staged){const key=entityKey(f)||(f.category==='truth'?'truth:'+normalized(f.title):null),exact=JSON.stringify([f.category,f.title,f.text]);if(!key&&seen.has(exact)){const target=facts[seen.get(exact)];target.sources=[...new Map([...target.sources,...f.sources].map(s=>[JSON.stringify([s.block_id,s.quote]),s])).values()];target.stats=Characters.mergeStats(target.stats,f.stats);if(f.reviewedByKeeper)target.reviewedByKeeper=true;continue;}
  if(key&&indices.has(key)){const target=facts[indices.get(key)];const paragraphs=new Set(target.text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean));for(const p of f.text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean))paragraphs.add(p);
   target.text=[...paragraphs].join('\n\n');if(f.character_type&&f.character_type!=='unknown'){if(!target.character_type||target.character_type==='unknown')target.character_type=f.character_type;else if(target.character_type!==f.character_type){target.character_type='unknown';issues.push({type:'conflict',description:'“'+f.title+'”的人物分组存在不同记载，请核对立场及条件。',source_block_ids:[...new Set([...target.sources,...f.sources].map(s=>s.block_id))],affected_titles:[f.title]});}} target.sources=[...new Map([...target.sources,...f.sources].map(s=>[JSON.stringify([s.block_id,s.quote]),s])).values()];target.stats=Characters.mergeStats(target.stats,f.stats);if(f.nature==='unknown')target.nature='unknown';if(f.reviewedByKeeper)target.reviewedByKeeper=true;
  }else{if(key)indices.set(key,facts.length);seen.set(exact,facts.length);facts.push({...f});}
 }
 for(const f of facts){const values=new Map();for(const row of f.stats||[]){const key=row.section+':'+row.label;if(values.has(key)&&values.get(key)!==row.value)issues.push({type:'conflict',description:'“'+f.title+'”的“'+row.label+'”有多个数值，保留各值，请核对条件及原文。',source_block_ids:[...new Set(f.sources.map(s=>s.block_id))],affected_titles:[f.title]});values.set(key,row.value);}}
 for(const f of facts)if(f.text.length>14000){f.text=f.text.slice(0,13800)+'\n\n（资料较长，其余细节请核对所附原文。）';issues.push({type:'needs_context',description:'“'+f.title+'”合并后的资料较长，请核对完整原文并精简卡片。原始分批草稿仍保存在任务记录中。',source_block_ids:[...new Set(f.sources.map(s=>s.block_id))],affected_titles:[f.title]});}
 return {facts,omitted,issues,rejectedDecisions};
}
