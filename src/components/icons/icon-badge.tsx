"use client";
import {conceptIcons,type IconConcept} from "./concept-icons";
export function IconBadge({concept}:{concept:IconConcept}){const Icon=conceptIcons[concept];return <span className="concept-icon-box"><Icon size="md"/></span>;}
