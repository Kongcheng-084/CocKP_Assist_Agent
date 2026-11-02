export const PROVIDERS=Object.freeze({
 openai:Object.freeze({id:'openai',name:'OpenAI',model:'gpt-4.1-mini',endpoint:'https://api.openai.com/v1/responses',modelsEndpoint:'https://api.openai.com/v1/models',keyFile:'openai-key.dat',keyEnv:'OPENAI_API_KEY'}),
 deepseek:Object.freeze({id:'deepseek',name:'DeepSeek',model:'deepseek-flash',endpoint:'https://api.deepseek.com/chat/completions',modelsEndpoint:'https://api.deepseek.com/models',keyFile:'deepseek-key.dat',keyEnv:'DEEPSEEK_API_KEY'})
});
export function providerInfo(id='openai'){if(!Object.hasOwn(PROVIDERS,id))throw new Error('请选择 OpenAI 或 DeepSeek。');return PROVIDERS[id];}
export function modelFor(settings,id){const p=providerInfo(id);return settings.models?.[id]||(id==='openai'?settings.model:null)||p.model;}
export function providerError(id,status,data={}){
 const p=providerInfo(id),code=data.error?.code;
 if(status===401)return p.name+' 密钥无效或已失效，请在应用设置中更新。';
 if(id==='deepseek'&&status===402)return 'DeepSeek 余额不足，请在 DeepSeek 平台检查账户余额。';
 if(code==='billing_not_active')return p.name+' 账户尚未启用 API 计费，请先在平台激活账单。';
 if(['insufficient_quota','billing_hard_limit_reached','insufficient_balance'].includes(code))return p.name+' API 余额或配额不足，请检查账户余额与额度。';
 if(status===429)return p.name+' 暂时限流，请稍后手动重试。';
 if(status===403||status===404)return p.name+' 暂时无权访问该模型，或模型名称不正确。';
 if(status===400||status===422)return p.name+' 不接受本次请求参数，请检查模型名称或缩小输入范围。';
 if(status>=500)return p.name+' 服务暂时不可用或繁忙，请稍后手动重试。';
 return p.name+' 请求未完成，请稍后重试。';
}
