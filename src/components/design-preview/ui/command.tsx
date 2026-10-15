"use client";
import * as React from "react";
import {Command as CommandPrimitive} from "cmdk";
import {Search} from "@/components/icons/concept-icons";
import {cn} from "@/lib/utils";
// shadcn Command 组合：保留 cmdk 的搜索、方向键与 Enter 选择语义。
export const Command=React.forwardRef<React.ElementRef<typeof CommandPrimitive>,React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(({className,...props},ref)=><CommandPrimitive ref={ref} className={cn("p-command",className)} {...props}/>);
Command.displayName="Command";
export const CommandInput=React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>,React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(({className,...props},ref)=><div className="p-command-input-wrap"><Search size={16}/><CommandPrimitive.Input ref={ref} className={cn("p-command-input",className)} {...props}/></div>);
CommandInput.displayName="CommandInput";
export const CommandList=React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>,React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(({className,...props},ref)=><CommandPrimitive.List ref={ref} className={cn("p-command-list",className)} {...props}/>);
CommandList.displayName="CommandList";
export const CommandEmpty=React.forwardRef<React.ElementRef<typeof CommandPrimitive.Empty>,React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>((props,ref)=><CommandPrimitive.Empty ref={ref} className="p-command-empty" {...props}/>);
CommandEmpty.displayName="CommandEmpty";
export const CommandGroup=React.forwardRef<React.ElementRef<typeof CommandPrimitive.Group>,React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>((props,ref)=><CommandPrimitive.Group ref={ref} className="p-command-group" {...props}/>);
CommandGroup.displayName="CommandGroup";
export const CommandItem=React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>,React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>((props,ref)=><CommandPrimitive.Item ref={ref} className="p-command-item" {...props}/>);
CommandItem.displayName="CommandItem";
