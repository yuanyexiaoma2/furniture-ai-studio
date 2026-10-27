import "dotenv/config";
import {db} from "../src/lib/db";
import {configureStudioModels} from "../src/lib/configure-studio-models";
try{console.log(JSON.stringify(await configureStudioModels(),null,2));console.log("模型目录已更新：智能体默认ZenMux，生图默认KIE；未调用付费接口。");}finally{await db.$disconnect();}
