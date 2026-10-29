/** 截图环境指纹：只读取浏览器版本、系统信息和已安装字体文件，不读取项目密钥。 */
import os from "node:os";
import path from "node:path";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";

export type RenderEnvironment={
 schemaVersion:1;chromeVersion:string;
 os:{platform:string;release:string;version:string;arch:string};
 fonts:{family:string;installed:boolean;files:{path:string;sha256:string}[]}[];
};
export async function collectRenderEnvironment(chromeVersion:string):Promise<RenderEnvironment>{
 if(process.platform!=="win32")throw Error("尚未实现此操作系统的字体文件盘点；请补充字体盘点后重拍原版，不能直接计算差异率。");
 const script=String.raw`[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $rows=@(); foreach($hive in @('LocalMachine','CurrentUser')){ $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::$hive,[Microsoft.Win32.RegistryView]::Default); $key=$base.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'); if($key){ foreach($name in $key.GetValueNames()){ if($name -match 'Segoe UI|Microsoft YaHei|PingFang'){ $rows+=@{name=$name;file=[string]$key.GetValue($name);hive=$hive} } }; $key.Close() }; $base.Close() }; ConvertTo-Json -InputObject @($rows) -Compress`;
 const registry=JSON.parse(execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],{encoding:"utf8"}).replace(/^\uFEFF/,"")) as {name:string;file:string;hive:string}[];
 const fonts=await Promise.all(["Segoe UI","Microsoft YaHei UI","PingFang SC"].map(async family=>{
  const files=[...new Set(registry.filter(r=>family==="Microsoft YaHei UI"?/Microsoft YaHei/.test(r.name):r.name.includes(family)).map(r=>path.resolve(path.isAbsolute(r.file)?r.file:path.join(r.hive==="CurrentUser"?path.join(process.env.LOCALAPPDATA!,"Microsoft/Windows/Fonts"):path.join(process.env.WINDIR??"C:/Windows","Fonts"),r.file))))].sort();
  return {family,installed:files.length>0,files:await Promise.all(files.map(async file=>({path:file,sha256:createHash("sha256").update(await readFile(file)).digest("hex")})))};
 }));
 return {schemaVersion:1,chromeVersion,os:{platform:os.platform(),release:os.release(),version:os.version(),arch:os.arch()},fonts};
}
export function assertRenderEnvironment(expected:RenderEnvironment|undefined,actual:RenderEnvironment){
 if(!expected)throw Error("对比基线缺少浏览器/系统/字体指纹；请先在原版提交重拍基线，不要直接计算差异率。");
 const changed=(Object.keys(actual) as (keyof RenderEnvironment)[]).filter(key=>JSON.stringify(expected[key])!==JSON.stringify(actual[key]));
 if(changed.length)throw Error(`截图环境不一致（${changed.join("、")}）；请在当前环境重拍原版提交的基线，不要直接计算差异率。`);
}
export async function checkRenderBaseline(directory:string,actual:RenderEnvironment){
 const manifest=JSON.parse(await readFile(path.join(directory,"manifest.json"),"utf8")) as {renderEnvironment?:RenderEnvironment};
 assertRenderEnvironment(manifest.renderEnvironment,actual);
}
