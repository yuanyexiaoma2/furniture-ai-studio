"use client";
import {useSession} from "next-auth/react";
export function useStudioAccess(){
 const {data,status}=useSession();
 return {ready:status!=="loading",canWrite:status==="authenticated"&&data?.user.role!=="viewer",userId:data?.user.id??""};
}
