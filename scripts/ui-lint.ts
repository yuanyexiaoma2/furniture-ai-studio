/** UI存量白名单：允许已登记的旧页面债务与商品/品牌数据，阻止新增违规。 */
import {readFileSync,readdirSync,writeFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
// 项目已有构建依赖；只在开发检查中解析CSS，不进入运行时包。
const postcss=require("postcss") as typeof import("postcss");
const baselinePath="scripts/ui-lint-baseline.json",tokens="src/styles/creative/tokens.css",icons="src/components/icons/concept-icons.ts";
type Finding={rule:"hex"|"small-font"|"svg-important"|"icon-import";file:string;line:number;signature:string;value:string};
type Allowance={rule:Finding["rule"];file:string;signature:string;count:number;reason:string};
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&e.name!=="generated"?walk(path.join(dir,e.name)):e.isFile()&&/\.(css|tsx?|mts)$/.test(e.name)?[path.join(dir,e.name).replaceAll("\\","/")]:[]);
const hex=/#[\da-fA-F]{8}\b|#[\da-fA-F]{6}\b|#[\da-fA-F]{4}\b|#[\da-fA-F]{3}\b/g,findings:Finding[]=[];
function small(value:string){const m=/^([\d.]+)(px|rem)$/.exec(value.trim());return m&&Number(m[1])*(m[2]==="rem"?16:1)<12;}
for(const file of walk("src")){
 const source=readFileSync(file,"utf8");
 if(file.endsWith(".css")){
  postcss.parse(source,{from:file}).walkDecls(d=>{
   const parent=d.parent,selector=parent&&"selector" in parent?String(parent.selector):"@"+(parent&&"name" in parent?String(parent.name):"root"),signature=JSON.stringify([selector,d.prop,d.value]),line=d.source?.start?.line??1;
   if(file!==tokens)for(const m of d.value.matchAll(hex))findings.push({rule:"hex",file,line,signature:signature+"|"+m[0],value:m[0]});
   if(d.prop==="font-size"&&small(d.value)||d.prop==="font"&&[...d.value.matchAll(/([\d.]+(?:px|rem))/g)].some(m=>small(m[1])))findings.push({rule:"small-font",file,line,signature,value:d.value});
   if(d.important&&/\bsvg\b|data-concept-icon/.test(selector))findings.push({rule:"svg-important",file,line,signature,value:d.toString()});
  });continue;
 }
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function at(n:ts.Node){return sf.getLineAndCharacterOfPosition(n.getStart()).line+1;}
 function visit(n:ts.Node){
  if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==="lucide-react"&&file!==icons)findings.push({rule:"icon-import",file,line:at(n),signature:"lucide-react",value:"直接导入"});
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==="lucide-react"&&file!==icons)findings.push({rule:"icon-import",file,line:at(n),signature:"lucide-react",value:"绕过入口再导出"});
  if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==="require")&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text==="lucide-react"&&file!==icons)findings.push({rule:"icon-import",file,line:at(n),signature:"lucide-react",value:"绕过入口动态导入"});
  if(file.endsWith(".tsx")&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n))){
   const value=n.getText(sf);for(const m of value.matchAll(hex))findings.push({rule:"hex",file,line:at(n),signature:m[0],value:m[0]});
   for(const m of value.matchAll(/text-\[([\d.]+(?:px|rem))\]/g))if(small(m[1]))findings.push({rule:"small-font",file,line:at(n),signature:m[0],value:m[1]});
  }
  if(file.endsWith(".tsx")&&ts.isPropertyAssignment(n)&&n.name.getText(sf)==="fontSize"){
   const v=n.initializer;if(ts.isNumericLiteral(v)&&Number(v.text)<12)findings.push({rule:"small-font",file,line:at(n),signature:"fontSize:"+v.text,value:v.text+"px"});else if(ts.isStringLiteral(v)&&small(v.text))findings.push({rule:"small-font",file,line:at(n),signature:"fontSize:"+v.text,value:v.text});
   // 14/zoom、12/zoom及产品数据字号均为动态值，不能静态当作小于12px。
  }
  ts.forEachChild(n,visit);
 }visit(sf);
}
const key=(f:Pick<Finding,"rule"|"file"|"signature">)=>JSON.stringify([f.rule,f.file,f.signature]);
if(process.argv.includes("--init-baseline")){
 if(!execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).startsWith("99f3187"))throw Error("只能在99f3187初始化本轮基线");
 if(existsSync(baselinePath))throw Error("白名单已存在，禁止自动扩充；清理存量后人工收紧");
 const allowed=findings.filter(f=>f.file==="src/app/globals.css"&&["hex","small-font"].includes(f.rule)||f.rule==="hex"&&["src/components/design-preview/task-cover.tsx","src/components/design-preview/batch/brand.tsx","src/components/design-preview/batch/workflow.tsx"].includes(f.file));
 const grouped=new Map<string,Allowance>();for(const f of allowed){const k=key(f),old=grouped.get(k);if(old)old.count++;else grouped.set(k,{rule:f.rule,file:f.file,signature:f.signature,count:1,reason:f.file.endsWith("globals.css")?"旧视觉存量，2b迁移；禁止同签名新增次数":"商品或品牌数据，不是界面样式；保留原数据色值"});}
 writeFileSync(baselinePath,JSON.stringify({baselineCommit:"99f3187",policy:"仅允许已登记签名及数量；常规lint:ui不会更新白名单。清理后应收紧对应条目。",allowances:[...grouped.values()]},null,2)+"\n");
 console.log("已初始化受限白名单；仅含旧globals和指定数据色值。常规检查不会新增条目。");
}
const baseline=JSON.parse(readFileSync(baselinePath,"utf8")) as {allowances:Allowance[]},remaining=new Map(baseline.allowances.map(a=>[key(a),a.count])),violations:Finding[]=[];
for(const finding of findings){const k=key(finding),count=remaining.get(k)??0;if(count>0)remaining.set(k,count-1);else violations.push(finding);}
for(const f of violations)console.error(`${f.file}:${f.line} [${f.rule}] ${f.value}`);
console.log(`UI检查：${findings.length}项存量匹配，${violations.length}项未登记/新增违规。`);
if(violations.length)process.exitCode=1;
