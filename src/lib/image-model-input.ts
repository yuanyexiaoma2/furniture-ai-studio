import {kieImageSpec} from "./image-models";
import type {ModelCandidate} from "./models.config";
import type {ImageRequest} from "./image-provider";
import {StudioError} from "./studio-error";

export function validateImageSelection(candidate:ModelCandidate,resolution:string,ratio:string,prompt:string,count:number){
 const spec=candidate.provider==="kie"?kieImageSpec(candidate.model):undefined;if(!spec)return;
 if(!(resolution in spec.prices))throw new StudioError(`${spec.name}不支持${resolution}，请选择${Object.keys(spec.prices).join("或")}`);
 if(!spec.ratios.includes(ratio))throw new StudioError(`${spec.name}不支持${ratio}比例，请重新选择`);
 if(prompt.length>spec.maxPrompt)throw new StudioError(`${spec.name}的完整提示词最多${spec.maxPrompt}字符，请缩短创作要求或选择其他模型`);
 if(count<1||count>spec.maxReferences)throw new StudioError(`${spec.name}需要1至${spec.maxReferences}张参考图`);
}
export function fitImageReferences<T extends {id:string}>(candidate:ModelCandidate,references:T[]){
 const limit=candidate.provider==="kie"?kieImageSpec(candidate.model)?.maxReferences:undefined;
 return [...new Map(references.map(ref=>[ref.id,ref])).values()].slice(0,limit);
}
export function buildKieImageInput(model:string,input:ImageRequest,urls:string[]):Record<string,unknown>{
 const spec=kieImageSpec(model);
 validateImageSelection({provider:"kie",model,supportsTools:false,pricing:{currency:"credits"}},input.resolution,input.aspectRatio,input.prompt,urls.length);
 if(spec?.format==="gpt25")return {prompt:input.prompt,input_urls:urls,aspect_ratio:input.aspectRatio,resolution:input.resolution,background:"opaque"};
 if(spec?.format==="qwen3")return {prompt:input.prompt,image_urls:urls,image_size:input.aspectRatio,resolution:input.resolution,output_format:input.outputFormat==="jpg"?"jpeg":"png",prompt_extend:false};
 return {prompt:input.prompt,image_input:urls,aspect_ratio:input.aspectRatio,resolution:input.resolution,output_format:input.outputFormat};
}
