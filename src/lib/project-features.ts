/** 个人项目暂停开关：前后端共用；恢复前需明确评估模型调用成本。 */
export const FEATURE_LIBRARY_IMPORT = process.env.NEXT_PUBLIC_FEATURE_LIBRARY_IMPORT === "true";
export const FEATURE_LIBRARY_PATTERNS = process.env.NEXT_PUBLIC_FEATURE_LIBRARY_PATTERNS === "true";
export const FEATURE_LIBRARY_RETRIEVAL = process.env.NEXT_PUBLIC_FEATURE_LIBRARY_RETRIEVAL === "true";
export const FEATURE_WEB_RESEARCH = process.env.NEXT_PUBLIC_FEATURE_WEB_RESEARCH === "true";
export const FEATURE_CASE_EXTRACTION = process.env.NEXT_PUBLIC_FEATURE_CASE_EXTRACTION === "true";
